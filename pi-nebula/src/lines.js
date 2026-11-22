// WHAT THE STATION'S PEOPLE SAY: their hellos, the captains' offers, and the little stories and gossip two people
// share when they stop to talk. All of it is data, to add to freely (chatter.js picks from it; people.js shows it in
// chat bubbles; sound/voices.js has the hellos that are spoken aloud).
//
// TALKS: each conversation is two people, A and B, taking turns: its lines go A, B, A, B... in order.
//   id        its own name (a conversation is not heard again for a while: chatter.js MEMORY)
//   lines     the words, in turns. {A} and {B} are the two speakers' names; {player} the player's name
//   news      (optional) a kind of news it is about (news.js): it is picked only while such news is going round, and
//             its facts fill in the lines where they say {winner}, {loser}, {score}, {ship}, {captain}, {crew}, {people},
//             {from} (a rescue the crew member was on: news.js), {planet},
//             {ore}, {tons}, {job}
//   about     (optional) the people it talks about, by their roster id: never said by them
//   who       (optional) only between these people, by roster id (both speakers among them)
//   sitting   (optional) true: only at a table; false: only standing
// Keep each line short (a bubble holds about 90 letters), friendly, and good for a child to read.

// a hello as someone passes (said in a bubble; a person's very first hello to the player is spoken in their voice,
// from voices.js); and again, later, when they have greeted the player before
export const HELLOS = ['Hi!', 'Hello!', 'Hey there!', 'Hey!', 'Oh, hi!', 'Hiya!', 'Good to see you!', 'Welcome aboard!'];
export const AGAIN = ['Hello again!', 'Hi again!', 'Hey!', 'Back again?', 'Oh, hello!', 'Hi there!'];

// THE CAPTAINS, looking for crew (life.js: a roster entry with `captain`): what they say when the player comes near.
//   what: the question's small words at the bottom of the screen; offer: who they are and what they want crew for,
//   ending with the question (its clip speaks it);
//   yes / no: their answer to Interested / Not now; again: when they have asked before; waiting: after a yes, until
//   missions are ready (missions.js); down: their ship is down for now, so no question (only who they are and that)
// a captain's word when the player has not answered a while
export const NUDGES = ['So, what do you say?', 'Take your time!', 'No rush. Think it over!', 'It will be fun, I promise!'];

export const CAPTAINS = {
  vega: { ship: 'Explorer', mission: 'exploring', what: 'Join his crew for a trip to new worlds?',
    offer: { clip: 'vega-pitch' }, yes: { clip: 'vega-ready' }, hello: { clip: 'vega-hello' },
    no: 'No problem. I\'ll be around!', again: 'Still looking for explorers. Interested?', waiting: 'Almost ready to fly. I\'ll find you!',
    // (his run is made, src/missions.js 'explore': as Captain Ruiz's and Captain Hale's, his contract, then he walks to the
    // Explorer and waits by its airstair; home, his word while the share is still waiting at its survey table. Bubbles:
    // no clips of these yet)
    contract: 'Wonderful. Here is my contract. Have a look.', signed: 'Glad to have you. I\'ll meet you at the Explorer.',
    payout: 'Good work out there. Your share is waiting at the Explorer\'s survey table.' },
  ruiz: { ship: 'Miner', mission: 'mining', what: 'Join his crew for a mining run?',
    offer: { clip: 'ruiz-pitch' }, yes: { clip: 'ruiz-ready' }, hello: { clip: 'ruiz-hello' },
    no: 'No worries. You know where to find me.', again: 'Still need hands for that mining run. Interested?', waiting: 'The Miner\'s nearly ready. Soon!',
    // (his mission is made, src/missions.js: contract: said as his contract's card comes up; signed: as it is signed,
    // in his own voice, and then he walks to his ship and waits by its way in (the game's maker, 2026-11-18: "once you
    // agree to a contract with the captain then they will say "Glad to have you, I will meet you at the ship". Then
    // they will start walking to the ship and wait by the door"; there is no "shall we go now": the run starts when the
    // crew member sits down in the seat); payout: home, the share still waiting.)
    contract: 'Great! Here is my contract. Have a look.', signed: { clip: 'ruiz-meet' },
    payout: 'Good work! Your share is waiting at the smelter\'s controls.' },
  hale: { ship: 'Medic', mission: 'rescue', what: 'Join her crew for a rescue mission?',
    offer: { clip: 'hale-pitch' }, yes: { clip: 'hale-ready' }, hello: { clip: 'hale-hello' },
    no: 'That\'s all right. Another time.', again: 'We still need a rescue crew. Interested?', waiting: 'Nearly ready. I\'ll come and find you.',
    // (her run is made, src/missions.js 'rescue': as Captain Ruiz's, her contract, then she walks to the Medic and waits
    // by its ramp; home, her word while the share is still waiting at the triage desk. Bubbles: no clips of these yet)
    contract: 'Wonderful. Here is my contract. Have a look.', signed: 'Glad to have you. I\'ll meet you at the Medic.',
    payout: 'Well done. Your share is waiting at the triage desk.' },
  // (Captain Adair, security: her ship is down for maintenance for now (the game's maker, 2026-11-17: "You could just
  // say their ship is down for maintenance for now.. until we make that job"): she says who she is and that, and asks
  // nothing; `down` keeps the question away until her job is made)
  adair: { ship: 'security ship', mission: 'security', down: true, what: null,
    offer: { clip: 'adair-pitch' }, hello: { clip: 'adair-hello' }, again: 'Hello again! My ship\'s still in for repairs.' },
};

// A CAPTAIN'S RUN (src/trip.js): what the captain says from the other seat as the run goes, one of each at its moment,
// in a bubble (no recorded clips yet). {player}: the crew member's name; {ore}: the metal; {tonnes}: the haul's ore;
// {engineer}: whoever is the run's engineer (the crew member, or the captain's own)
export const RUN_TALK = {
  mining: {
    // THE CORE'S TUNING (src/tune.js; the game's maker, 2026-11-18: "if you signed up for engineering then the captain
    // tells you the core needs to be adjusted. So you go back to mechanical and answer so questions there. Then you
    // make your way back up to the pilot seat to jump the ship back home"). tune: after the ship says "Reactor
    // imbalance.", out at the rocks (on arrival there, or before the jump home); tuned: the core tuned, back to the seat
    tune: ['The core needs adjusting, {player}. Head back to Engineering.'],
    tuned: ['The core is steady. Back to your seat, {player}.'],
    // (the core tuned, and the next part not theirs: they carry on as they like, on their feet or in a seat)
    tunedFree: ['The core is steady. Good work, {player}.'],
    // (on their feet when the next part is theirs: the run waits for them in their seat)
    backJump: ['Back to your seat, {player}. The jump is yours.'],
    backDrill: ['Back to your seat, {player}. The drill is yours.'],
    out: ['We\'re clear of the station. Work out the jump, pilot.', 'Clear of the station. The jump computer is yours, {player}.'],
    there: ['Here we are. The rocks.', 'That\'s the jump. We\'re at the rocks.'],
    // (the crew's driller has marked a rock: {driller} is the one of his crew who drills; fieldMine, when the captain
    // drills it himself)
    field: ['There\'s a good one. Take it, {driller}.', 'That one, {driller}. Bring it in.'],
    fieldMine: ['There\'s a good one. I\'ll bring it in. {engineer}, watch the core.', 'That one. I\'ll take it.'],
    // (signed for the pilot's seat and not the drill: the rock is marked and theirs to fly to)
    fieldFly: ['{driller} has marked one for you, {player}. Fly us over.', 'See {driller}\'s mark? Take us to it, {player}.'],
    full: ['Eight canisters full. Take us home, pilot.', 'That\'s the load. Home, {player}.'],
    home: ['There\'s the station. Take us in, {player}.', 'Home. In through the bay door, {player}, and down in our hangar.'],
    homeCrew: ['There\'s the station. Juno has the landing.', 'Home. Juno takes her in.'],
    // (as the crew member gets up; nothing in it weighs up the landing: nose in or crooked, it is down)
    landed: ['We\'re home, {player}. Your share is at the smelter\'s controls.'],
    // (the crew member at the drill, src/drillview.js; and the lines for a run whose pilot is the captain's own)
    crewOut: ['We\'re clear of the station. Juno has the jump.', 'Clear of the station. Juno is working out the jump.'],
    crewJump: ['Juno has us at the rocks. The drill is yours, {player}.', 'Here we are. Find us a good rock, {player}.'],
    drillField: ['Look for the glow, {player}. More glow, more ore.', 'The scan is up. Find us a good one.'],
    pick: ['Going in for that one.', 'That one it is.'],
    broke: ['That one\'s done. Find us another.', 'She\'s all in pieces. Next rock!'],
    fullCrew: ['Eight canisters full. Juno, take us home.', 'That\'s the load. Home, Juno.'],
    // (the crew member at the drill headed home before all eight were full)
    early: ['That\'s the load. Home, {player}.'], earlyCrew: ['That\'s the load. Home, Juno.'],
    landedCrew: ['Good work, {player}. Your share is at the smelter\'s controls.'],
  },
  // CAPTAIN HALE'S RESCUE RUN (src/missions.js 'rescue'; at the planet src/rescue.js). {pilot}, {medic}: who of her
  // crew flies and who opens the pods (the crew member, or one of hers: their name as said)
  rescue: {
    tune: ['The core needs adjusting, {player}. Head back to Engineering.'],
    tuned: ['The core is steady. Back to your seat, {player}.'],
    tunedFree: ['The core is steady. Good work, {player}.'],
    backJump: ['Back to your seat, {player}. The jump is yours.'],
    // (the pilot on their feet as the rescue begins, the core tuned on arrival: finding the wreck is theirs, from the seat)
    backFind: ['Back to your seat, {player}. Find us that wreck.'],
    out: ['We\'re clear of the station. Work out the jump, pilot.', 'Clear of the station. The jump computer is yours, {player}.'],
    crewOut: ['We\'re clear of the station. {pilot} has the jump.', 'Clear of the station. {pilot} is working out the jump.'],
    there: ['There\'s the planet. Their ship came down just ahead.', 'That\'s the jump. There\'s the planet.'],
    // (out of the wormhole: who sets the Medic down beside the wreck. Her pilot: down; the crew member with the pilot's
    // seat: first the sensors (find), then theirs to fly down (found); downAuto: the autopilot's, should a pilot's run
    // ever set it down for them)
    down: ['I can see the wreck. Take us down beside it, {pilot}.', 'There\'s the wreck. Set us down by it, {pilot}.'],
    find: ['The crash site is close, {player}. Find the wreck on the sensors.', 'Their distress call is near. Find the wreck on the sensors, {player}.'],
    found: ['There it is. Set us down beside the wreck, {player}.', 'Good. Take us down by the wreck, {player}.'],
    downAuto: ['I can see the wreck. The autopilot will set us down beside it, {player}.'],
    // (down in the ring beside the wreck: the pods are opened (her paramedic's job, or the crew member's: sitePod) and
    // their sleepers come aboard; backAboard: everyone in their place, the crew member still outside)
    site: ['We\'re down. {medic}, see to the pods.', 'Down safe. Off you go, {medic}. Open the pods.'],
    sitePod: ['We\'re down. The pods are yours, {player}. Down the ramp you go.', 'Down safe. Down the ramp to the pods, {player}, and open each lock.'],
    backAboard: ['Everyone is aboard, {player}. Back up the ramp.', 'That\'s everyone. Come back aboard, {player}.'],
    aboard: ['Everyone is aboard and resting. Take us home, {player}.'],
    aboardCrew: ['Everyone is aboard and resting. Take us home, {pilot}.'],
    home: ['There\'s the station. Take us in, {player}.', 'Home. In through the bay door, {player}, and down in our hangar.'],
    homeCrew: ['There\'s the station. {pilot} has the landing.', 'Home. {pilot} takes her in.'],
    landed: ['We\'re home, {player}. Your share is at the triage desk.'],
    landedCrew: ['Good work, {player}. Your share is at the triage desk.'],
  },
  // CAPTAIN VEGA'S EXPLORING RUN (src/missions.js 'explore'): the lines every run of his has. What each run is about,
  // and his words for it (out, at each place, the lead, the finding), are the run's own scenario's, laid over these:
  // src/exploreplan.js SCENARIOS. {sensor}: whoever scans at the survey table (the crew member, or his own)
  explore: {
    tune: ['The core needs adjusting, {player}. Head back to Engineering.'],
    tuned: ['The core is steady. Back to your seat, {player}.'],
    tunedFree: ['The core is steady. Good work, {player}.'],
    backJump: ['Back to your seat, {player}. The jump is yours.'],
    out: ['We\'re clear of the station. Work out the jump, pilot.'],
    crewOut: ['We\'re clear of the station. {pilot} has the jump.'],
    // (the sensor operator's scan, out at a place: to the survey table, and done)
    scan: ['To the survey table, {player}. The scan is yours.'],
    scanned: ['Good reading, {player}.'],
    home: ['There\'s the station. Take us in, {player}.', 'Home. In through the bay door, {player}, and down in our hangar.'],
    homeCrew: ['There\'s the station. {pilot} has the landing.', 'Home. {pilot} takes her in.'],
    landed: ['We\'re home, {player}. Your share is at the survey table.'],
    landedCrew: ['Good work, {player}. Your share is at the survey table.'],
  },
};

// THE SCAN (people.js): what the medic and the patient say at the big scanner, in bubbles, one of each at its moment:
// the medic's hello as the patient comes up to the bed's foot and the patient's answer; the medic's word as they lie
// down, one while the ring goes (during) and one nearer the end (late); the end; the patient's thanks as they go.
// {patient} and {medic}: their names
export const SCAN_TALK = {
  hello: ["Hi {patient}! Hop up on the bed for me.", "Hello, {patient}! Up on the bed, please.", "Ready for your scan, {patient}? Up you get."],
  answer: ["Okay!", "Sure thing.", "Here I go."],
  still: ["Lie nice and still now.", "Here we go. Keep still for me.", "Relax. This won't take long."],
  during: ["Looking good.", "Nice and still. Well done.", "Breathe normally. You're doing great."],
  late: ["Almost done now.", "Nearly finished.", "One more pass to go."],
  done: ["All done! You're in great shape.", "All finished. Everything looks fine!", "That's it! All clear."],
  thanks: ["Thanks, {medic}!", "Thank you!", "Thanks! See you soon."],
};

export const TALKS = [
  // ── the news going round ──
  { id: 'mathball-1', news: 'mathball', lines: ["Did you hear {loser} lost at Mathball last night?", "Oh wow, I thought {loser} was unbeatable!", "{winner} won, {score}. Everyone was cheering."] },
  { id: 'mathball-2', news: 'mathball', lines: ["{winner} beat {loser} at Mathball!", "No way! What was the score?", "{score}. It was close the whole time.", "I want a ticket for the rematch."] },
  { id: 'mathball-3', news: 'mathball', lines: ["Are you watching the Mathball rematch?", "{loser} against {winner} again? Of course!"] },
  { id: 'rescue-1', news: 'rescue', lines: ["Did you hear? The {ship} ship brought home {crew}!", "They were stranded past the asteroid belt for days.", "{captain} never gives up, does she?"] },
  { id: 'rescue-2', news: 'rescue', lines: ["The {ship} ship is back from the rescue.", "Is everyone all right?", "{crew}, all safe and sound.", "That's the best news all week."] },
  // (a rescue the crew member was on: how many came home and from where, as the station's line says it)
  { id: 'rescue-3', news: 'rescue', lines: ["The {ship} brought {people} home today!", "From where?", "{from}. They were asleep in stasis pods.", "I'm so glad they're safe."] },
  { id: 'planet-1', news: 'planet', lines: ["They found a new planet people could live on!", "Really? What's it called?", "{planet}. It has oceans, I heard.", "Oceans! I'd go just to swim."] },
  { id: 'planet-2', news: 'planet', lines: ["Would you live on {planet}?", "Only if they have a galley as good as ours."] },
  { id: 'haul-1', news: 'haul', about: ['ruiz'], lines: ["The {ship} ship came back with {tons} tons of {ore}!", "That's one lucky rock.", "Captain Ruiz says it was the richest one yet."] },
  { id: 'haul-2', news: 'haul', about: ['smelter'], lines: ["Did you see the {ship} ship? Full of {ore} to the top.", "Ivo will be busy at the smelter tonight."] },
  { id: 'player-1', news: 'player', lines: ["Did you see {player} working in the {job}?", "Quick with numbers, that one!"] },
  { id: 'player-2', news: 'player', lines: ["{player} just did a shift in the {job}.", "We could use more crew like that."] },
  // ── the station's own stories ──
  { id: 'soup', about: ['cook'], lines: ["This soup is amazing. What's in it?", "Bo says it's a secret. I think it's asteroid beans.", "Asteroid beans aren't real.", "Then what's crunching?"] },
  { id: 'rivets', lines: ["I counted the rivets on the airlock door this morning.", "Why would you do that?", "There are 144. That's 12 times 12!", "You need a hobby."] },
  { id: 'smelter-hot', about: ['smelter'], lines: ["Is it just me, or is it warm today?", "The smelter's running hot. Ivo's pouring titanium."] },
  { id: 'helmet', lines: ["I think I left my helmet in the hangar again.", "Again? That's the third time this week!"] },
  { id: 'view', lines: ["The view from these windows never gets old.", "You can see the tail of the nebula from here."] },
  { id: 'vega-sleep', about: ['vega'], lines: ["Captain Vega never seems to sleep.", "He's an android. He doesn't need to!", "Lucky. I need nine hours."] },
  { id: 'cat', lines: ["Has anyone seen the station cat?", "She was asleep on the warm crane rails this morning.", "Of course she was."] },
  { id: 'scanner', about: ['medic'], lines: ["The big scanner's so quiet today.", "Ana says it only moves when someone's on the bed."] },
  { id: 'flying', lines: ["I'm learning to fly the Explorer.", "How's it going?", "I can land it. Mostly."] },
  { id: 'aliens', about: ['vega'], lines: ["Do you think there are aliens out there?", "Captain Vega says the stars are full of surprises."] },
  { id: 'comet', about: ['rook'], lines: ["Old Captain Rook told me about the comet storm again.", "The one with the giant snowball?", "That one. It gets bigger every time he tells it."] },
  { id: 'flower', lines: ["My plant in the window box finally flowered!", "Space flowers! What colour?", "Purple, of course."] },
  { id: 'drift', lines: ["I worked out how far the station drifts in a year.", "And?", "About three million kilometres. Don't worry, it's on purpose."] },
  { id: 'pancakes', about: ['cook'], lines: ["Bo once made pancakes with the gravity turned off.", "What happened?", "Two of them are still on the ceiling."] },
  { id: 'mathball-play', lines: ["Want to play Mathball later?", "Only if I'm on your team.", "Deal!"] },
  { id: 'crane-dream', lines: ["I dreamt I was a canister on the crane last night.", "Did you get smelted?", "I woke up just in time."] },
  { id: 'tooth', about: ['medic'], lines: ["Ana fixed my wobbly tooth today.", "Did it hurt?", "Not a bit. She's the best medic on the station."] },
  { id: 'stars', about: ['vega'], lines: ["How many stars can you see from here?", "Too many to count.", "Captain Vega counted them once. It took him all night."] },
  { id: 'cups', lines: ["Who keeps putting the cups back upside down?", "That's how they do it on Mars."] },
  { id: 'new-crew', lines: ["Have you met the new crew member yet?", "Yes! Very friendly. Knows their times tables, too."] },
  { id: 'ship-buy', lines: ["One day I'm going to buy my own ship.", "What would you call it?", "The Pi. Because it goes on forever."] },
  { id: 'rook-medal', about: ['rook'], lines: ["Is it true old Captain Rook has a medal for bravery?", "Two medals. He keeps them in his sock drawer."] },
  { id: 'robot-chess', lines: ["I lost at chess to the cleaning robot again.", "How many times is that?", "Seven. But who's counting?", "The robot is."] },
  { id: 'gravity', lines: ["Did the gravity feel a bit strong this morning?", "The engineers turned it up by one percent.", "That explains why my coffee felt heavy."] },
  { id: 'half-pie', lines: ["Bo cut the moon pie into eight slices.", "I had two of them.", "So you ate a quarter of the pie!", "A very good quarter."] },
  { id: 'comet-tonight', lines: ["There's a comet passing tonight.", "What time?", "Twenty-two hundred hours. Bring a blanket."] },
  { id: 'lost-wrench', lines: ["Has anyone seen my big wrench?", "It's floating in the airlock again."] },
  { id: 'space-plants', lines: ["The tomatoes in the window boxes are huge this week.", "That's the starlight. Plants love it up here."] },
  { id: 'hundred-laps', lines: ["I walked a hundred laps of the loop today.", "That's about five kilometres!", "My feet know."] },
  { id: 'nap', lines: ["Did you nap through the shift change again?", "I was resting my eyes. Very carefully."] },
  { id: 'birthday', lines: ["It's Jon's birthday on Friday.", "Let's bake him a cake shaped like a spanner."], about: ['mechanic'] },
  // ── at a table ──
  { id: 'pass-salt', sitting: true, lines: ["Could you pass the salt, please?", "Here you go. Careful, the lid's loose."] },
  { id: 'dessert', sitting: true, about: ['cook'], lines: ["Is there any dessert today?", "Bo made moon pie. Half of it's already gone."] },
  { id: 'noodles', sitting: true, lines: ["These noodles are three times longer than yesterday's.", "Three times? Then I'll need three times the fork."] },
  // ── two captains meeting ──
  { id: 'captains-1', who: ['vega', 'ruiz', 'hale', 'rook'], lines: ["Found any crew yet?", "One or two. Everyone wants to fly!"] },
  { id: 'captains-2', who: ['vega', 'ruiz', 'hale', 'rook'], lines: ["Your ship's looking shiny today.", "Jon polished the engines. Twice."] },
];
