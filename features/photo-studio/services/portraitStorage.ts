import type { PortraitState } from '../utils/portrait'

/**
 * Guarda en el navegador la foto original y la modificada del comprador.
 * El backend todavía no recibe la foto editada (solo el retrato del enrolamiento facial),
 * por eso vive aquí; cuando exista el endpoint, se sube desde savePortrait().
 */
export interface StoredPortrait {
  original: string
  modified: string
  state: PortraitState
  updatedAt: string
}

const PREFIX = 'nt-portrait:'

function key(buyerId: number | null): string {
  return `${PREFIX}${buyerId ?? 'demo'}`
}

export function loadPortrait(buyerId: number | null): StoredPortrait | null {
  if (!import.meta.client) return null
  try {
    const raw = localStorage.getItem(key(buyerId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredPortrait
    return parsed?.original && parsed?.modified ? parsed : null
  }
  catch {
    return null
  }
}

/** Devuelve false si el navegador no tiene espacio o bloquea el almacenamiento. */
export function savePortrait(buyerId: number | null, portrait: StoredPortrait): boolean {
  try {
    localStorage.setItem(key(buyerId), JSON.stringify(portrait))
    return true
  }
  catch {
    return false
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la imagen.'))
    reader.readAsDataURL(blob)
  })
}
