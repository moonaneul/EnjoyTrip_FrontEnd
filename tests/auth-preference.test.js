import assert from 'node:assert/strict';

class MemoryStorage {
  constructor(){ this.map=new Map(); }
  getItem(k){ return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k,v){ this.map.set(k,String(v)); }
  removeItem(k){ this.map.delete(k); }
  clear(){ this.map.clear(); }
}
globalThis.localStorage = new MemoryStorage();

const auth = await import('../js/core/authStorage.js');
const pref = await import('../js/features/preferences/preferenceStorage.js');
const trips = await import('../js/core/tripStorage.js');

const created = await auth.createUser({ email:'Test@Example.com', password:'password123!', nickname:'테스터' });
assert.ok(created.id);
assert.equal(auth.getCurrentUser(), null);
const loggedIn = await auth.login({ email:'test@example.com', password:'password123!' });
assert.equal(auth.getCurrentUser().id, loggedIn.id);
assert.equal(pref.getUserPreference(loggedIn.id), null);

pref.saveUserPreference(loggedIn.id, {
  completed:true,
  categoryWeights:{ culture:.9, food:.4 },
});
assert.equal(pref.getUserPreference(loggedIn.id).completed, true);

const saved = trips.saveTrip({ plannerInput:{ origin:{label:'광주'} }, plan:{ type:'slow' }, ownerUserId:loggedIn.id });
assert.equal(trips.listTrips({ ownerUserId:loggedIn.id }).length, 1);
assert.equal(saved.ownerUserId, loggedIn.id);

pref.deleteUserPreference(loggedIn.id);
trips.deleteTripsByOwner(loggedIn.id);
auth.deleteCurrentUser();
assert.equal(pref.getUserPreference(loggedIn.id), null);
assert.equal(trips.listTrips({ ownerUserId:loggedIn.id }).length, 0);
assert.equal(auth.getCurrentUser(), null);

console.log('Auth + preference + trip ownership tests passed');
