/**
 * Servicio de archivos.
 * MOCK: guarda los Blob en IndexedDB del navegador y devuelve ids 'local-…'.
 * Se reemplaza por el endpoint real de subida cuando Integrante 3 lo publique
 * (misma firma: upload(blob) -> { fileId }).
 */

const DB_NAME = 'nt-files'
const STORE = 'files'

export interface UploadedFile {
  fileId: string
  mime: string
  size: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result as T)
      req.onerror = () => reject(req.error)
    })
  }
  finally {
    db.close()
  }
}

export const fileService = {
  async upload(blob: Blob): Promise<UploadedFile> {
    const fileId = `local-${crypto.randomUUID()}`
    await tx('readwrite', store => store.put(blob, fileId))
    return { fileId, mime: blob.type, size: blob.size }
  },

  async get(fileId: string): Promise<Blob | null> {
    return (await tx<Blob | undefined>('readonly', store => store.get(fileId))) ?? null
  },

  async remove(fileId: string): Promise<void> {
    await tx('readwrite', store => store.delete(fileId))
  }
}
