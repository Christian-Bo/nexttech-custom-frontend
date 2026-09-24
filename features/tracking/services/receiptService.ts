import { useApi } from '~/services/api'
import { downloadBlob } from '~/services/credentialService'
import { useMockOrders } from '~/services/mock/mockOrders'
import { formatDateTime, formatQ } from '~/utils/format'

/**
 * Constancia de compra (ticket) en PDF con el QR de entrega.
 * - API real: GET /api/orders/{codigo}/receipt (la genera el backend y también llega por correo).
 * - Modo demo: se arma en el navegador con los datos del simulador.
 */
export function useReceiptService() {
  const useMocks = !!useRuntimeConfig().public.useMocks
  const api = useMocks ? null : useApi()

  async function mockReceipt(codigo: string): Promise<Blob> {
    const o = useMockOrders().orders.value.find(x => x.codigoOrden === codigo)
    const [{ jsPDF }, qrModule] = await Promise.all([import('jspdf'), import('qrcode')])
    const QRCode = qrModule.default ?? qrModule
    const qr = await QRCode.toDataURL(codigo, { margin: 1, width: 320 })
    const doc = new jsPDF({ unit: 'mm', format: [80, 150] })
    doc.setFillColor(37, 99, 235)
    doc.rect(0, 0, 80, 16, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('NextTech Custom', 40, 8, { align: 'center' })
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text('Constancia de compra', 40, 12.5, { align: 'center' })
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text(codigo, 40, 26, { align: 'center' })
    doc.addImage(qr, 'PNG', 20, 30, 40, 40)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text('Muestra este QR al repartidor al recibir tu pedido', 40, 74, { align: 'center' })
    let y = 84
    const row = (label: string, value: string) => {
      doc.setTextColor(100, 116, 139)
      doc.text(label, 8, y)
      doc.setTextColor(15, 23, 42)
      doc.text(doc.splitTextToSize(value, 44) as string[], 72, y, { align: 'right' })
      y += 7
    }
    if (o) {
      row('Fecha', formatDateTime(o.fechaCreacion))
      row('Producto', `${o.cantidad} x ${o.producto}`)
      row('Entrega', o.areaEntrega)
      row('Referencia', o.referenciaEntrega)
      row('Pago', o.metodoPago === 'EFECTIVO' ? 'Efectivo al recibir' : 'Tarjeta')
      doc.setDrawColor(203, 213, 225)
      doc.line(8, y - 3, 72, y - 3)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      row('Total', formatQ(o.total))
    }
    return doc.output('blob')
  }

  async function download(codigo: string): Promise<void> {
    const blob = api
      ? await api<Blob>(`/api/orders/${encodeURIComponent(codigo)}/receipt`, { responseType: 'blob', timeout: 30_000 })
      : await mockReceipt(codigo)
    downloadBlob(blob, `constancia-${codigo}.pdf`)
  }

  return { download }
}
