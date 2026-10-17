/** El contrato V4 solo admite cuatro ubicaciones, no coordenadas libres. */
export const credentialSlots = ['TOP_LEFT', 'TOP_RIGHT', 'BOTTOM_LEFT', 'BOTTOM_RIGHT'] as const
export type CredentialSlot = typeof credentialSlots[number]
export type StickerSlots = Record<string, string>

export function allowedCredentialSlots(backendSlots: readonly string[]): CredentialSlot[] {
  return credentialSlots.filter(slot => backendSlots.includes(slot))
}

export function placeCredentialSticker(
  existing: StickerSlots,
  stickerId: string,
  target: string,
  backendSlots: readonly string[],
  backendStickerIds: readonly string[]
): StickerSlots {
  if (!allowedCredentialSlots(backendSlots).some(s => s === target) || !backendStickerIds.includes(stickerId)) return existing
  return { ...existing, [target]: stickerId }
}

/** Mover un sticker conserva el del destino: si ambos están ocupados, intercambia las posiciones. */
export function moveCredentialSticker(
  existing: StickerSlots,
  source: string,
  target: string,
  backendSlots: readonly string[]
): StickerSlots {
  const allowed = allowedCredentialSlots(backendSlots)
  if (!allowed.some(s => s === source) || !allowed.some(s => s === target) || source === target || !existing[source]) return existing
  return { ...existing, [source]: existing[target] || '', [target]: existing[source] }
}

export function serializeCredentialStickers(
  existing: StickerSlots,
  backendSlots: readonly string[],
  backendStickerIds: readonly string[]
): { stickerId: string, slot: string }[] {
  return allowedCredentialSlots(backendSlots)
    .filter(slot => !!existing[slot] && backendStickerIds.includes(existing[slot]))
    .map(slot => ({ stickerId: existing[slot]!, slot }))
}
