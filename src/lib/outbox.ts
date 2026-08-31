"use client";

/**
 * Offline outbox — an IndexedDB queue of messages the user tried to send while the
 * relay was unreachable.
 *
 * Design notes:
 *  - entries store the *already-encrypted* payload, never plaintext. If the tab dies
 *    before flush, the worst case is that a sealed blob sits in IndexedDB until the
 *    next successful flush (or the TTL burns it locally).
 *  - flush is idempotent: the message id is generated once at enqueue time, so a
 *    retry cannot duplicate a row on the relay.
 *  - this is deliberately not a Service Worker feature: SW cannot hold the vault key
 *    (that would put key material somewhere we cannot reliably zero), so the outbox
 *    drains when the app is open. Honest limitation, documented in THREAT-MODEL.md.
 */

const DB_NAME = "ked-outbox";
const STORE = "pending";
const VERSION = 1;

export interface OutboxEntry {
  id: string;
  roomId: string;
  kind: string;
  header: string;
  body: string;
  ttlMs: number | null;
  queuedAt: number;
  attempts: number;
  lastError?: string;
}

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id" });
        os.createIndex("queuedAt", "queuedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => resolve(null);
  });
}

export const outbox = {
  async count(): Promise<number> {
    const n = await tx<number>("readonly", (s) => s.count());
    return n ?? 0;
  },

  async enqueue(entry: Omit<OutboxEntry, "queuedAt" | "attempts">): Promise<void> {
    await tx("readwrite", (s) => s.put({ ...entry, queuedAt: Date.now(), attempts: 0 }));
  },

  async all(): Promise<OutboxEntry[]> {
    const rows = await tx<OutboxEntry[]>("readonly", (s) => s.getAll());
    return (rows ?? []).sort((a, b) => a.queuedAt - b.queuedAt);
  },

  async remove(id: string): Promise<void> {
    await tx("readwrite", (s) => s.delete(id));
  },

  async bumpAttempt(entry: OutboxEntry, error: string): Promise<void> {
    await tx("readwrite", (s) => s.put({ ...entry, attempts: entry.attempts + 1, lastError: error.slice(0, 200) }));
  },

  /** Give up after enough failures or expiration so a permanently broken room does not spin forever. */
  shouldDrop(entry: OutboxEntry): boolean {
    if (entry.ttlMs && Date.now() - entry.queuedAt > entry.ttlMs) return true;
    return entry.attempts >= 4 || (Date.now() - entry.queuedAt > 1000 * 60 * 60 * 24 * 3);
  },
  async clear(): Promise<void> {
    await tx("readwrite", (s) => s.clear());
  },
};
