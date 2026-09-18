// Everything lives on her phone, in IndexedDB: items, photos (as JPEG blobs) and a few settings.
const DB_NAME = 'curbside';
const DB_VERSION = 1;

let opening = null;

export function db() {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('items')) d.createObjectStore('items', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('photos')) {
          d.createObjectStore('photos', { keyPath: 'id' }).createIndex('itemId', 'itemId');
        }
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
      };
      req.onsuccess = () => {
        const d = req.result;
        // Another tab upgraded the database: let go so it isn't blocked.
        d.onversionchange = () => d.close();
        resolve(d);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Close trash2treasure in your other tabs, then try again.'));
    });
    opening.catch(() => { opening = null; });
  }
  return opening;
}

const request = (r) => new Promise((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});

const finished = (t) => new Promise((resolve, reject) => {
  t.oncomplete = () => resolve();
  t.onerror = () => reject(friendly(t.error));
  t.onabort = () => reject(friendly(t.error));
});

function friendly(err) {
  if (err?.name === 'QuotaExceededError') return new Error("Your phone is out of space for trash2treasure. Free some space, or back up and delete old sold items.");
  return err || new Error("Couldn't save. Try again.");
}

export async function getAll(store) {
  const d = await db();
  return request(d.transaction(store).objectStore(store).getAll());
}

export async function get(store, key) {
  const d = await db();
  return request(d.transaction(store).objectStore(store).get(key));
}

export async function put(store, value, key) {
  const d = await db();
  const t = d.transaction(store, 'readwrite');
  if (key === undefined) t.objectStore(store).put(value);
  else t.objectStore(store).put(value, key);
  return finished(t);
}

// One item plus any new photos, saved together so a photo never exists without its item.
export async function saveItem(item, photos = []) {
  const d = await db();
  const t = d.transaction(['items', 'photos'], 'readwrite');
  for (const p of photos) t.objectStore('photos').put(p);
  t.objectStore('items').put(item);
  return finished(t);
}

export async function deletePhotos(ids) {
  const d = await db();
  const t = d.transaction('photos', 'readwrite');
  for (const id of ids) t.objectStore('photos').delete(id);
  return finished(t);
}

export async function deleteItem(item) {
  const d = await db();
  const t = d.transaction(['items', 'photos'], 'readwrite');
  t.objectStore('items').delete(item.id);
  const index = t.objectStore('photos').index('itemId');
  index.openKeyCursor(IDBKeyRange.only(item.id)).onsuccess = (e) => {
    const cursor = e.target.result;
    if (!cursor) return;
    t.objectStore('photos').delete(cursor.primaryKey);
    cursor.continue();
  };
  return finished(t);
}

export async function photosFor(itemId) {
  const d = await db();
  return request(d.transaction('photos').objectStore('photos').index('itemId').getAll(IDBKeyRange.only(itemId)));
}

export async function allPhotoIds() {
  const d = await db();
  return request(d.transaction('photos').objectStore('photos').getAllKeys());
}

export async function wipe() {
  const d = await db();
  const t = d.transaction(['items', 'photos', 'meta'], 'readwrite');
  for (const s of ['items', 'photos', 'meta']) t.objectStore(s).clear();
  return finished(t);
}
