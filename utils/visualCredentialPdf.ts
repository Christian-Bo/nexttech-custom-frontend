import type { VisualCredentialDesign, VisualCredentialSticker, VisualCredentialTheme } from '~/utils/credentialVisualDesign'

interface VisualCredentialPdfData {
  nickname: string
  role: string
  buyerId: number | null
  portraitUrl: string
  qrCredential: string
  design: VisualCredentialDesign
}

const W = 720
const H = 1200

const themes: Record<VisualCredentialTheme, { base: string, surface: string, accent: string, second: string }> = {
  BLUE_NEON: { base: '#0c1530', surface: '#173766', accent: '#38d9f8', second: '#1766ed' },
  DARK_CARBON: { base: '#0c111b', surface: '#25303d', accent: '#cbd5e1', second: '#4c586a' },
  PURPLE_PULSE: { base: '#1c123e', surface: '#422277', accent: '#d6a7ff', second: '#7c3aed' }
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string): void {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('No se pudo leer la fotografía o el QR para crear el PDF.'))
    image.src = src
  })
}

function drawSticker(ctx: CanvasRenderingContext2D, sticker: VisualCredentialSticker, x: number, y: number, size: number): void {
  const diameter = Math.max(21, size * 0.70)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(sticker.rotation * Math.PI / 180)
  ctx.shadowColor = '#061123'
  ctx.shadowBlur = 9
  ctx.fillStyle = '#ffe886'
  ctx.strokeStyle = '#ffe886'
  ctx.lineWidth = Math.max(3, diameter / 9)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const kind = sticker.stickerId.toUpperCase()

  if (kind === 'STAR') {
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 - Math.PI / 2
      const r = i % 2 === 0 ? diameter / 2 : diameter / 5
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fill()
  }
  else if (kind === 'CODE') {
    ctx.beginPath()
    ctx.moveTo(-diameter * .17, -diameter * .30)
    ctx.lineTo(-diameter * .45, 0)
    ctx.lineTo(-diameter * .17, diameter * .30)
    ctx.moveTo(diameter * .17, -diameter * .30)
    ctx.lineTo(diameter * .45, 0)
    ctx.lineTo(diameter * .17, diameter * .30)
    ctx.moveTo(diameter * .08, -diameter * .40)
    ctx.lineTo(-diameter * .08, diameter * .40)
    ctx.stroke()
  }
  else if (kind === 'GAMER') {
    roundedRect(ctx, -diameter * .48, -diameter * .28, diameter * .96, diameter * .56, diameter * .20, '#ffe886')
    ctx.shadowBlur = 0
    ctx.strokeStyle = '#17223b'
    ctx.lineWidth = Math.max(2, diameter / 11)
    ctx.beginPath()
    ctx.moveTo(-diameter * .30, 0)
    ctx.lineTo(-diameter * .08, 0)
    ctx.moveTo(-diameter * .19, -diameter * .11)
    ctx.lineTo(-diameter * .19, diameter * .11)
    ctx.stroke()
    ctx.fillStyle = '#17223b'
    ctx.beginPath()
    ctx.arc(diameter * .22, -diameter * .09, diameter * .055, 0, 2 * Math.PI)
    ctx.arc(diameter * .31, diameter * .08, diameter * .055, 0, 2 * Math.PI)
    ctx.fill()
  }
  else {
    ctx.strokeRect(-diameter * .42, -diameter * .30, diameter * .84, diameter * .54)
    ctx.beginPath()
    ctx.moveTo(-diameter * .20, diameter * .35)
    ctx.lineTo(diameter * .20, diameter * .35)
    ctx.moveTo(0, diameter * .25)
    ctx.lineTo(0, diameter * .34)
    ctx.stroke()
  }
  ctx.restore()
}

/** Crea un PDF local con el mismo secreto QR que acaba de activar el backend.
 * Este módulo NUNCA emite ni rota QR, tampoco sube fotos o PDF a servicios externos.
 */
export async function buildVisualCredentialPdf(data: VisualCredentialPdfData): Promise<Blob> {
  if (!data.portraitUrl || !data.qrCredential) throw new Error('Faltan la fotografía oficial o el QR vigente.')
  const [{ jsPDF }, qrModule, portrait] = await Promise.all([
    import('jspdf'), import('qrcode'), loadImage(data.portraitUrl)
  ])
  const QRCode = qrModule.default ?? qrModule
  const qrImage = await loadImage(await QRCode.toDataURL(data.qrCredential, {
    errorCorrectionLevel: 'H', margin: 2, width: 620,
    color: { dark: '#101828', light: '#FFFFFF' }
  }))
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo preparar el documento en este dispositivo.')
  const theme = themes[data.design.theme] ?? themes.BLUE_NEON

  const gradient = ctx.createLinearGradient(0, 0, W, H)
  gradient.addColorStop(0, theme.second)
  gradient.addColorStop(.19, theme.base)
  gradient.addColorStop(1, theme.surface)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#ffffff09'
  ctx.beginPath()
  ctx.arc(625, 330, 280, 0, 2 * Math.PI)
  ctx.fill()
  roundedRect(ctx, 38, 37, W - 76, H - 74, 35, '#080f271e')

  ctx.fillStyle = '#f8fbff'
  ctx.font = 'bold 32px Inter, Arial, sans-serif'
  ctx.fillText('N✦  NextTech Custom', 82, 114)
  ctx.fillStyle = '#cae2ff'
  ctx.font = 'bold 16px Inter, Arial, sans-serif'
  ctx.fillText('CREDENCIAL DIGITAL', 84, 145)
  ctx.fillStyle = theme.accent
  ctx.fillRect(82, 178, W - 164, 3)

  const px = 201, py = 215, ps = 318
  roundedRect(ctx, px - 11, py - 11, ps + 22, ps + 22, 27, theme.accent)
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(px, py, ps, ps, 18)
  ctx.clip()
  const scale = Math.max(ps / portrait.naturalWidth, ps / portrait.naturalHeight)
  const dw = portrait.naturalWidth * scale, dh = portrait.naturalHeight * scale
  ctx.drawImage(portrait, px + (ps - dw) / 2, py + (ps - dh) / 2, dw, dh)
  for (const sticker of data.design.stickers) {
    const x = px + sticker.x * ps
    const y = py + sticker.y * ps
    drawSticker(ctx, sticker, x, y, sticker.size * ps)
  }
  ctx.restore()

  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 36px Inter, Arial, sans-serif'
  const nickname = (data.nickname || 'Comprador').slice(0, 34)
  const measured = ctx.measureText(nickname).width
  if (measured > 570) ctx.font = `bold ${Math.floor(36 * 570 / measured)}px Inter, Arial, sans-serif`
  ctx.fillText(nickname, W / 2, 615)
  ctx.font = 'bold 18px Inter, Arial, sans-serif'
  ctx.fillStyle = theme.accent
  ctx.fillText((data.role || 'COMPRADOR').slice(0, 35), W / 2, 656)

  // No se dibujan stickers sobre el QR ni se cambia su contenido: escaneo seguro.
  roundedRect(ctx, 194, 689, 332, 332, 23, '#ffffff')
  ctx.drawImage(qrImage, 211, 706, 298, 298)
  ctx.fillStyle = '#e1eeff'
  ctx.font = '16px Inter, Arial, sans-serif'
  ctx.fillText('Escanea para ingresar a NextTech', W / 2, 1054)
  ctx.fillStyle = '#b5c4df'
  ctx.font = '14px Inter, Arial, sans-serif'
  ctx.fillText(`ID ${data.buyerId ?? '—'}  |  Credencial personal`, W / 2, 1128)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [72, 120] })
  doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 72, 120)
  return doc.output('blob')
}
