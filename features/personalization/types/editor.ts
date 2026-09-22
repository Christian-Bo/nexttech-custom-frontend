/**
 * Tipos del editor de personalización (Fabric.js).
 * Zonas y lienzos según SQL Server: ZonaPersonalizacion + PlantillaVarianteZona.
 */

export type ProductShape = 'CIRCULAR' | 'CUADRADO' | 'RECTANGULAR'

/** Clave de lado. Mapea a ZonaPersonalizacion.Nombre ('Lado A' / 'Lado B'). */
export type SideKey = 'A' | 'B'

export interface ZoneTemplate {
  key: SideKey
  /** Nombre tal cual en BD: 'Lado A' | 'Lado B'. */
  name: string
  required: boolean
}

/** Plantilla de una variante personalizable (PlantillaVarianteZona). */
export interface ProductTemplate {
  /** VarianteProducto.CodigoVariante */
  code: string
  name: string
  shape: ProductShape
  /** Lienzo lógico en px (AnchoLienzo / AltoLienzo). */
  width: number
  height: number
  /** Radio de esquinas para formas rectangulares (px lógicos). */
  cornerRadius?: number
  zones: ZoneTemplate[]
  /** true = medidas aún no confirmadas en BD. */
  provisional?: boolean
}

export type EditorObjectKind = 'text' | 'image' | 'sticker' | 'shape'

/** Formato de ConfiguracionJson por zona. Guarda REFERENCIAS a archivos, nunca Data URLs. */
export interface ZoneDesignJson {
  version: 1
  width: number
  height: number
  /** Salida de Fabric `canvas.toObject()` con `src` vacío en imágenes y `fileId` como referencia. */
  fabric: Record<string, unknown>
}

export interface DesignJson {
  productCode: string
  updatedAt: string
  zones: Partial<Record<SideKey, ZoneDesignJson>>
}

/** Resultado final para enviar al backend (Integrante 3). */
export interface DesignExport {
  design: DesignJson
  /** PNG final por zona -> IdArchivoImagenFinal. */
  images: Partial<Record<SideKey, Blob>>
}

export type ImageFilterName = 'none' | 'grayscale' | 'sepia' | 'vintage' | 'bright'
