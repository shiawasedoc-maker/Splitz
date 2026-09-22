/* db.js — local-only storage for หารค่าทริป
 *
 * Everything the user enters is kept in this browser's IndexedDB on this device.
 * This file contains no network code: no fetch, no XMLHttpRequest, no WebSocket.
 *
 * Database "tripsplit", version 1
 *   store "trips" (keyPath "id")  one record per trip: members, expenses, exchange rates
 *   store "meta"  (out-of-line keys) small settings, e.g. "lastTripId"
 */
"use strict";
const DB = (() => {
  const NAME = 'tripsplit';
  const VERSION = 1;
  let dbPromise = null;

  function open() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB not available'));
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const r = indexedDB.open(NAME, VERSION);
        r.onupgradeneeded = () => {
          const db = r.result;
          if (!db.objectStoreNames.contains('trips')) db.createObjectStore('trips', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
        };
        r.onsuccess = () => {
          const db = r.result;
          db.onversionchange = () => db.close();
          resolve(db);
        };
        r.onerror = () => { dbPromise = null; reject(r.error); };
        r.onblocked = () => { dbPromise = null; reject(new Error('IndexedDB blocked')); };
      });
    }
    return dbPromise;
  }

  const req = r => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });

  // Runs fn inside one transaction and resolves only after the transaction has committed.
  async function tx(stores, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(stores, mode);
      let out;
      Promise.resolve(fn(t)).then(v => { out = v; }, err => { try { t.abort(); } catch (_) {} reject(err); });
      t.oncomplete = () => resolve(out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('transaction aborted'));
    });
  }

  return {
    open,
    getAllTrips: () => tx(['trips'], 'readonly', t => req(t.objectStore('trips').getAll())),
    putTrip: trip => tx(['trips'], 'readwrite', t => { t.objectStore('trips').put(trip); }),
    putTrips: trips => tx(['trips'], 'readwrite', t => { const s = t.objectStore('trips'); trips.forEach(x => s.put(x)); }),
    deleteTrip: id => tx(['trips'], 'readwrite', t => { t.objectStore('trips').delete(id); }),
    getMeta: key => tx(['meta'], 'readonly', t => req(t.objectStore('meta').get(key))),
    setMeta: (key, value) => tx(['meta'], 'readwrite', t => { t.objectStore('meta').put(value, key); }),
    deleteMeta: key => tx(['meta'], 'readwrite', t => { t.objectStore('meta').delete(key); }),
    clearAll: () => tx(['trips', 'meta'], 'readwrite', t => { t.objectStore('trips').clear(); t.objectStore('meta').clear(); })
  };
})();
