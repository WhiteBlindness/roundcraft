const DB_NAME = 'roundcraft'
const DB_VERSION = 1
const DRAFTS_STORE = 'drafts'
const KEYS_STORE = 'idempotency_keys'

export interface MainDraft {
  readonly evidence_ids: readonly string[]
  readonly action_id: string
  readonly qualifier_id: string
  readonly confidence_id: string
}

interface DraftRecord {
  readonly attemptId: string
  readonly draft: MainDraft
  readonly updatedAt: number
}

interface KeyRecord {
  readonly attemptId: string
  readonly key: string
}

let dbInstance: IDBDatabase | null = null
let dbFailed = false

function openDb(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance)
  if (dbFailed) return Promise.reject(new Error('IndexedDB unavailable'))

  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      dbFailed = true
      reject(new Error('IndexedDB unavailable'))
      return
    }

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
        db.createObjectStore(DRAFTS_STORE, { keyPath: 'attemptId' })
      }
      if (!db.objectStoreNames.contains(KEYS_STORE)) {
        db.createObjectStore(KEYS_STORE, { keyPath: 'attemptId' })
      }
    }

    request.onsuccess = () => {
      dbInstance = request.result
      dbInstance.onclose = () => { dbInstance = null }
      resolve(dbInstance)
    }

    request.onerror = () => {
      dbFailed = true
      reject(request.error)
    }
  })
}

function idbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly')
        const store = tx.objectStore(storeName)
        const req = store.get(key)
        req.onsuccess = () => resolve(req.result as T | undefined)
        req.onerror = () => reject(req.error)
      }),
  )
}

function idbPut<T>(storeName: string, value: T): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        const req = store.put(value)
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      }),
  )
}

function idbDelete(storeName: string, key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        const req = store.delete(key)
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      }),
  )
}

export async function loadDraft(
  attemptId: string,
): Promise<MainDraft | null> {
  try {
    const record = await idbGet<DraftRecord>(DRAFTS_STORE, attemptId)
    if (!record || !Array.isArray(record.draft.evidence_ids)) return null
    return record.draft
  } catch {
    return null
  }
}

export async function saveDraft(
  attemptId: string,
  draft: MainDraft,
): Promise<void> {
  try {
    await idbPut<DraftRecord>(DRAFTS_STORE, {
      attemptId,
      draft,
      updatedAt: Date.now(),
    })
  } catch {
    // Draft persistence is best-effort; the server remains authoritative.
  }
}

export async function clearDraft(attemptId: string): Promise<void> {
  try {
    await idbDelete(DRAFTS_STORE, attemptId)
  } catch {
    // Cleanup is best-effort.
  }
}

export async function loadIdempotencyKey(
  attemptId: string,
): Promise<string> {
  try {
    const record = await idbGet<KeyRecord>(KEYS_STORE, attemptId)
    if (record?.key) return record.key
  } catch {
    // Fall through to generate a new key.
  }
  return crypto.randomUUID()
}

export async function saveIdempotencyKey(
  attemptId: string,
  key: string,
): Promise<void> {
  try {
    await idbPut<KeyRecord>(KEYS_STORE, { attemptId, key })
  } catch {
    // Key persistence is best-effort.
  }
}

export async function clearIdempotencyKey(
  attemptId: string,
): Promise<void> {
  try {
    await idbDelete(KEYS_STORE, attemptId)
  } catch {
    // Cleanup is best-effort.
  }
}

export interface LoadedDraftState {
  readonly draft: MainDraft | null
  readonly idempotencyKey: string
}

export async function loadDraftState(
  attemptId: string,
): Promise<LoadedDraftState> {
  const [draft, idempotencyKey] = await Promise.all([
    loadDraft(attemptId),
    loadIdempotencyKey(attemptId),
  ])
  return { draft, idempotencyKey }
}
