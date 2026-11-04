// COLLARS: the collars a rider can put on a dog of their own at the general store's animals counter (src/shop.js), and
// the same colours the Dog Lab's collar control offers (labs/dogs). Plain data, no three.js: the save, the store, the
// tests and the lab read it as it is; dogkind.js makes the dog wearing one (the collar is part of the dog's own mesh:
// still one draw a dog).
//
// A rider's pick is saved with the dog (rider.owned.dogs[i].collar, src/save.js): { colour: COLLARS id, studs: bool },
// or no collar field at all (a dog with none, every dog from before there were collars).
//
//   COLLARS             [{ id, name, colour }]  leather and dyed webbing a valley store would have had, muted (the red is
//                       the family's Boston's: with the studs, that dog's look is one pick)
//   STUDS               the studs' colour: pale nickel
//   cleanPick(p)        a saved pick, cleaned: { colour, studs } or null (none, or anything that isn't a pick)
//   collarLook(p)       -> { colour: '#hex', studs: '#hex' | null }: a breed's collar (dogbreeds.js), or null
//   collarKey(p)        'red' | 'red-studs' | '' (none)
//   collarKind(kind, p) the animal library's id for that dog wearing that collar: 'boston' (none), 'boston+red-studs'
//   splitKind(id)       -> { kind, pick }: the dog and its collar, back out of such an id
export const COLLARS = [
  { id: 'red', name: 'Red', colour: '#c4302b' },
  { id: 'brown', name: 'Brown leather', colour: '#7f4f2c' },
  { id: 'black', name: 'Black', colour: '#1f1b19' },
  { id: 'blue', name: 'Blue', colour: '#36578a' },
  { id: 'green', name: 'Green', colour: '#4b6e3d' },
];
export const STUDS = '#d8d2c4';
const byId = (id) => COLLARS.find((c) => c.id === id) || null;
export function cleanPick(p) {
  if (!p || typeof p !== 'object' || !byId(p.colour)) return null;
  return { colour: p.colour, studs: p.studs === true };
}
export function collarLook(p) {
  const c = cleanPick(p); if (!c) return null;
  return { colour: byId(c.colour).colour, studs: c.studs ? STUDS : null };
}
export const collarKey = (p) => { const c = cleanPick(p); return c ? c.colour + (c.studs ? '-studs' : '') : ''; };
export const collarKind = (kind, p) => { const k = collarKey(p); return k ? `${kind}+${k}` : kind; };
export function splitKind(id) {
  const [kind, key = ''] = String(id).split('+'), [colour, studs] = key.split('-');
  return { kind, pick: cleanPick({ colour, studs: studs === 'studs' }) };
}
