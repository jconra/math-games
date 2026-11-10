// shared/players.js: one game's saved players, kept in the browser (localStorage). Each game makes its own store on
// its own key, so two games' saves never mix.
//
//   const store = makeStore({ key: 'my-game.players', version: 1, fix, max: 6, game: 'My Game' })
//   store.load()            -> every saved player, the one who played last first. Never throws.
//   store.save(player)      writes this player now (adds it if new) -> true if the browser really kept it
//   store.make(name, look)  -> a fresh player with every default filled in (NOT saved until save())
//   store.remove(id)
//   store.works()           -> true while the browser is really keeping the saves
//   store.useKey(key)       a different storage key (test pages do this so they never touch real players)
//   store.max               how many players a family can make
//
// `fix(player)` is the game's own tidy-up of one saved player: it fills in the game's defaults (coins, progress...)
// and returns the player. The store has already made sure of what every game shares:
//   { id, name (16 letters at most), look (whatever the game keeps there), made, last (when they last played, 0 for
//     never), age (3..99 or null) }   and it keeps any field it does not know, so a newer build's save survives an
//     older one.
//
// WHAT IS STORED is the same shape as Mathwood Valley's saves (src/save.js there, which came first and keeps its own
// code): { version, riders: [player, ...] } under one key. The list is called `riders` in every game's save, on
// purpose: one shape, so a family's players could be shared between the games one day.
//
// If the browser blocks saving (a private window), everything still works from a copy in memory until the tab closes,
// and works() says so. A save too damaged to read is kept under key + '.broken' so it can be rescued by hand.

function num(v, dflt = 0) { v = Number(v); return Number.isFinite(v) ? v : dflt; }

export function makeId() {
  return 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

export function makeStore({ key, version = 1, fix = null, max = 6, game = 'The game', anyName = 'Player' } = {}) {
  if (!key) throw new Error('makeStore: a storage key is needed');
  const KEY0 = String(key);
  let KEY = KEY0;
  // The latest blob, kept in memory. It is the fallback when storage is blocked, and it wins over storage whenever the
  // last write to storage failed (so a full disk can't roll a player back to an older save).
  let memory = null, lastWriteOk = true, lastReadOk = true;

  const emptyBlob = () => ({ version, riders: [] });

  function readBlob() {
    let blob = null;
    try {
      const raw = globalThis.localStorage.getItem(KEY);
      lastReadOk = true;
      if (raw) {
        try { blob = JSON.parse(raw); } catch (e) {
          console.warn(`${game}: the saved players could not be read; kept a copy under`, KEY + '.broken');
          try { globalThis.localStorage.setItem(KEY + '.broken', raw); } catch (e2) { /* nothing more we can do */ }
          blob = null;
        }
      }
    } catch (e) { lastReadOk = false; }
    if (!lastReadOk || !lastWriteOk) {
      if (memory) return JSON.parse(JSON.stringify(memory));   // a copy, so edits only land when saved
      return blob && Array.isArray(blob.riders) ? blob : emptyBlob();
    }
    if (!blob || !Array.isArray(blob.riders)) blob = emptyBlob();
    return blob;
  }

  function writeBlob(blob) {
    blob.version = version;
    // The memory copy is a deep copy, so later changes to live player objects don't leak into it until saved.
    try { memory = JSON.parse(JSON.stringify(blob)); } catch (e) { /* a player with a loop in it; keep the old copy */ }
    try {
      globalThis.localStorage.setItem(KEY, JSON.stringify(blob));
      lastWriteOk = true;
      return true;
    } catch (e) {
      lastWriteOk = false;
      return false;
    }
  }

  // One saved player, made safe: what every game shares, then the game's own tidy-up.
  function fixPlayer(r) {
    r = r && typeof r === 'object' ? r : {};
    const out = { ...r };
    out.id = typeof r.id === 'string' && r.id ? r.id : makeId();
    out.name = String(r.name == null ? '' : r.name).trim().slice(0, 16) || anyName;
    out.look = r.look && typeof r.look === 'object' ? r.look : {};
    out.made = num(r.made, Date.now());
    out.last = num(r.last, 0);
    const age = Math.round(Number(r.age));
    out.age = r.age != null && age >= 3 && age <= 99 ? age : null;
    return (fix && fix(out)) || out;
  }

  return {
    max,
    get key() { return KEY; },
    useKey(k) { KEY = String(k || KEY0); memory = null; lastWriteOk = true; lastReadOk = true; },
    works() {
      try {
        const s = globalThis.localStorage;
        if (!s) return false;
        const probe = KEY + '.probe';
        s.setItem(probe, '1'); s.removeItem(probe);
        return lastWriteOk && lastReadOk;
      } catch (e) { return false; }
    },
    load() {
      try {
        const players = readBlob().riders.map(fixPlayer);
        players.sort((a, b) => (b.last - a.last) || (a.made - b.made));
        return players;
      } catch (e) {
        console.warn(`${game}: could not load the saved players`, e);
        return [];
      }
    },
    save(player) {
      if (!player || !player.id) return false;
      try {
        const blob = readBlob();
        const copy = JSON.parse(JSON.stringify(player));
        const i = blob.riders.findIndex(r => r && r.id === player.id);
        if (i >= 0) blob.riders[i] = copy; else blob.riders.push(copy);
        return writeBlob(blob);
      } catch (e) {
        console.warn(`${game}: could not save the player`, e);
        return false;
      }
    },
    make(name, look) {
      return fixPlayer({ id: makeId(), name, look, made: Date.now(), last: 0 });
    },
    remove(id) {
      try {
        const blob = readBlob();
        blob.riders = blob.riders.filter(r => r && r.id !== id);
        return writeBlob(blob);
      } catch (e) {
        console.warn(`${game}: could not delete the player`, e);
        return false;
      }
    },
    fix: fixPlayer,
  };
}
