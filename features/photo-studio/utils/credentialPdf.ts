/**
 * Credencial digital en PDF con la foto modificada del comprador (client-only).
 * Tamaño de la página: 70 x 110 mm, vertical.
 */
export interface CredentialPdfData {
  nickname: string
  buyerId: number | null
  qrCredential: string
  /** Data URL JPEG/PNG del retrato 3:4. */
  portrait: string
  issuedAt: Date
}

const W = 70
const H = 110

export function credentialFileName(nickname: string): string {
  const safe = nickname
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return `credencial-nexttech${safe ? `-${safe}` : ''}.pdf`
}

export function formatIssuedAt(date: Date): string {
  return date.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function imageFormat(dataUrl: string): 'JPEG' | 'PNG' {
  return dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'
}

export async function buildCredentialPdf(data: CredentialPdfData): Promise<Blob> {
  const [{ jsPDF }, qrModule] = await Promise.all([import('jspdf'), import('qrcode')])
  const QRCode = qrModule.default ?? qrModule
  const qr = await QRCode.toDataURL(data.qrCredential, { errorCorrectionLevel: 'M', margin: 1, width: 360 })

  const doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: 'portrait' })

  // Fondo y franja superior (paleta 60-30-10).
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, W, H, 'F')
  doc.setFillColor(37, 99, 235)
  doc.rect(0, 0, W, 14, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('NextTech Custom', W / 2, 8, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.text('Credencial digital del comprador', W / 2, 11.5, { align: 'center' })

  // Foto modificada (3:4) con borde de acento.
  const photoW = 30
  const photoH = 40
  const photoX = (W - photoW) / 2
  const photoY = 18
  doc.setFillColor(6, 182, 212)
  doc.roundedRect(photoX - 0.8, photoY - 0.8, photoW + 1.6, photoH + 1.6, 2, 2, 'F')
  doc.addImage(data.portrait, imageFormat(data.portrait), photoX, photoY, photoW, photoH)

  // Datos.
  doc.setTextColor(248, 250, 252)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(data.nickname || 'Comprador', W / 2, photoY + photoH + 7, { align: 'center', maxWidth: W - 8 })
  doc.setFontSize(7)
  doc.setTextColor(6, 182, 212)
  doc.text('COMPRADOR', W / 2, photoY + photoH + 11.5, { align: 'center' })

  // QR sobre fondo blanco para que se lea bien.
  const qrSize = 26
  const qrX = (W - qrSize) / 2
  const qrY = photoY + photoH + 15
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(qrX - 1.5, qrY - 1.5, qrSize + 3, qrSize + 3, 1.5, 1.5, 'F')
  doc.addImage(qr, 'PNG', qrX, qrY, qrSize, qrSize)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.setTextColor(148, 163, 184)
  const footer = `ID ${data.buyerId ?? '-'}   |   Emitida ${formatIssuedAt(data.issuedAt)}`
  doc.text(footer, W / 2, H - 4, { align: 'center' })

  return doc.output('blob')
}
