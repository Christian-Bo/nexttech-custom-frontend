import type { DeliveryArea, ProductDetail, ProductVariant } from '../types/catalog'
import { PRODUCT_TEMPLATES } from '~/features/personalization/config/products'

/**
 * Catálogo de demostración. Los códigos de variante coinciden con las plantillas del editor
 * (features/personalization/config/products.ts) para que "Personalizar" abra la correcta.
 */
const ZONAS_AB = [
  { idZona: 1, nombre: 'Lado A', esObligatoria: true, ordenVisual: 1 },
  { idZona: 2, nombre: 'Lado B', esObligatoria: true, ordenVisual: 2 }
]

function variant(idVariante: number, codigo: string, nombre: string, precio: number, base: number, atributos: [string, string][]): ProductVariant {
  const t = PRODUCT_TEMPLATES.find(p => p.code === codigo)
  const forma = t?.shape ?? 'RECTANGULAR'
  return {
    idVariante,
    codigoVariante: codigo,
    nombre,
    precioAdicional: precio - base,
    precioActual: precio,
    atributos: atributos.map(([atributo, valor]) => ({ atributo, valor })),
    plantillas: (t?.zones ?? []).map((_, i) => ({ idZona: i + 1, forma, anchoLienzo: t?.width ?? 800, altoLienzo: t?.height ?? 800 }))
  }
}

export const MOCK_PRODUCTS: ProductDetail[] = [
  {
    codigoProducto: 'LLV-ACR',
    nombre: 'Llavero acrílico',
    descripcion: 'Acrílico transparente de 3 mm con impresión a color por ambos lados. Ligero y resistente.',
    categoria: 'Llaveros',
    precioBase: 35,
    permitePersonalizacion: true,
    medidas: { diametroLlaveroPulgadas: 2, diametroNfcPulgadas: 1, diametroLlaveroMm: 50.8, diametroNfcMm: 25.4, lienzoPx: 800, nfcLienzoPx: 400 },
    variantes: [
      variant(101, 'LLV-ACR-CIR-MED', 'Circular', 35, 35, [['Forma', 'Circular'], ['Tamaño', '5 cm']]),
      variant(102, 'LLV-ACR-CUA-MED', 'Cuadrado', 35, 35, [['Forma', 'Cuadrado'], ['Tamaño', '5 cm']])
    ],
    zonas: ZONAS_AB
  },
  {
    codigoProducto: 'LLV-MET',
    nombre: 'Llavero metálico',
    descripcion: 'Aluminio con acabado brillante y argolla reforzada. Tu diseño sublimado en los dos lados.',
    categoria: 'Llaveros',
    precioBase: 45,
    permitePersonalizacion: true,
    medidas: { diametroLlaveroPulgadas: 2, diametroNfcPulgadas: 1, diametroLlaveroMm: 50.8, diametroNfcMm: 25.4, lienzoPx: 800, nfcLienzoPx: 400 },
    variantes: [
      variant(103, 'LLV-MET-CIR-MED', 'Circular', 45, 45, [['Forma', 'Circular'], ['Material', 'Aluminio']]),
      variant(104, 'LLV-MET-CUA-MED', 'Cuadrado', 48, 45, [['Forma', 'Cuadrado'], ['Material', 'Aluminio']])
    ],
    zonas: ZONAS_AB
  },
  {
    codigoProducto: 'PHC',
    nombre: 'Photocard',
    descripcion: 'Tarjeta tipo photocard con esquinas redondeadas, impresa por ambos lados en papel satinado.',
    categoria: 'Tarjetas',
    precioBase: 10,
    permitePersonalizacion: true,
    medidas: null,
    variantes: [variant(105, 'PHC-STD', 'Estándar', 10, 10, [['Tamaño', '5.5 × 8.5 cm']])],
    zonas: ZONAS_AB
  },
  {
    codigoProducto: 'IMN',
    nombre: 'Imán rectangular',
    descripcion: 'Imán flexible para refrigerador o casillero con tu foto favorita.',
    categoria: 'Imanes',
    precioBase: 15,
    permitePersonalizacion: true,
    medidas: null,
    variantes: [variant(106, 'IMN-RECT', 'Rectangular', 15, 15, [['Tamaño', '9 × 6 cm']])],
    zonas: [ZONAS_AB[0]!]
  }
]

export const MOCK_DELIVERY_AREAS: DeliveryArea[] = [
  { idAreaEntrega: 1, nombre: 'Entrada principal', descripcion: 'Garita de seguridad' },
  { idAreaEntrega: 2, nombre: 'Cafeteria', descripcion: 'Frente a la caja' },
  { idAreaEntrega: 3, nombre: 'Biblioteca', descripcion: 'Segundo nivel' },
  { idAreaEntrega: 4, nombre: 'Edificio principal', descripcion: 'Lobby del primer nivel' }
]

export function findMockVariant(idVariante: number): { product: ProductDetail, variant: ProductVariant } | null {
  for (const product of MOCK_PRODUCTS) {
    const v = product.variantes.find(x => x.idVariante === idVariante)
    if (v) return { product, variant: v }
  }
  return null
}
