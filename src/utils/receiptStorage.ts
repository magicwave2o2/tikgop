/**
 * IndexedDB vault for storing compressed receipt photos cleanly outside localStorage
 * so localStorage never hits its ~5MB quota even after thousands of scanned receipts.
 */

const DB_NAME = 'tikgop_receipts_db';
const DB_VERSION = 1;
const STORE_NAME = 'receipts';
const RECEIPT_PREFIX = 'idb_rcpt_';

let dbPromise: Promise<IDBDatabase> | null = null;

function openReceiptDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB open error'));
    });
  }
  return dbPromise;
}

export function isIndexedDBReceiptRef(value?: string): boolean {
  return Boolean(value && value.startsWith(RECEIPT_PREFIX));
}

/**
 * Stores a receipt data URL in IndexedDB and returns a lightweight reference ID.
 * Falls back gracefully to returning the original dataUrl if IndexedDB is unavailable.
 */
export async function saveReceiptImage(dataUrl: string): Promise<string> {
  if (!dataUrl || isIndexedDBReceiptRef(dataUrl)) return dataUrl;
  const id = `${RECEIPT_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  try {
    const db = await openReceiptDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(dataUrl, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return id;
  } catch {
    return dataUrl;
  }
}

/**
 * Resolves either an IndexedDB receipt reference ID or legacy inline data URL to a displayable image URL.
 */
export async function loadReceiptImage(refOrDataUrl?: string): Promise<string | null> {
  if (!refOrDataUrl) return null;
  if (!isIndexedDBReceiptRef(refOrDataUrl)) return refOrDataUrl;
  try {
    const db = await openReceiptDB();
    return await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(refOrDataUrl);
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function deleteReceiptImage(ref?: string): Promise<void> {
  if (!isIndexedDBReceiptRef(ref)) return;
  try {
    const db = await openReceiptDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(ref!);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore cleanup failures
  }
}

export async function clearAllReceiptImages(): Promise<void> {
  try {
    const db = await openReceiptDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore cleanup failures
  }
}
