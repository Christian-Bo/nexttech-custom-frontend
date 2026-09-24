<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { AdminArea, AdminCategory, AdminProductDetail, AdminProductSummary, AdminVariant, CanvasShape } from '../types/catalogAdmin'
import { useCatalogAdminService } from '../services/catalogAdminService'
import { isApiError } from '~/services/api'
import { formatQ } from '~/utils/format'

/** Parametrización del catálogo: productos y variantes, categorías y áreas de entrega (solo ADMIN). */
const service = useCatalogAdminService()
const snackbar = useSnackbar()
const { confirm } = useConfirm()

const section = ref<'productos' | 'categorias' | 'areas'>('productos')
const SHAPES: { value: CanvasShape, title: string }[] = [
  { value: 'CIRCULAR', title: 'Circular' },
  { value: 'CUADRADA', title: 'Cuadrada' }
]

const products = ref<AdminProductSummary[]>([])
const categories = ref<AdminCategory[]>([])
const areas = ref<AdminArea[]>([])
const loading = ref(true)
const busy = ref<string | null>(null)

const activeCategories = computed(() => categories.value.filter(c => c.activo))

async function run<T>(key: string, action: () => Promise<T>, ok?: string): Promise<T | null> {
  busy.value = key
  try {
    const r = await action()
    if (ok) snackbar.success(ok)
    return r
  }
  catch (e) {
    snackbar.error(isApiError(e) ? e : 'No se pudo completar la acción.')
    return null
  }
  finally {
    busy.value = null
  }
}

async function loadAll(): Promise<void> {
  loading.value = true
  try {
    const [p, c, a] = await Promise.all([service.products(), service.categories(), service.areas()])
    products.value = p
    categories.value = c
    areas.value = a
  }
  catch (e) {
    snackbar.error(isApiError(e) ? e : 'No se pudo cargar el catálogo.')
  }
  finally {
    loading.value = false
  }
}

/* ---------- Producto ---------- */
const productDialog = ref(false)
const editingProduct = ref<string | null>(null)
const pForm = reactive({ idCategoria: 0, codigoProducto: '', nombre: '', descripcion: '', precioBase: 0, permitePersonalizacion: true })
const pValid = computed(() => pForm.idCategoria > 0 && pForm.nombre.trim().length > 0 && pForm.precioBase >= 0
  && (!!editingProduct.value || /^[A-Z0-9-]{3,30}$/i.test(pForm.codigoProducto.trim())))

function newProduct(): void {
  editingProduct.value = null
  Object.assign(pForm, { idCategoria: activeCategories.value[0]?.idCategoria ?? 0, codigoProducto: '', nombre: '', descripcion: '', precioBase: 0, permitePersonalizacion: true })
  productDialog.value = true
}

async function editProduct(p: AdminProductSummary): Promise<void> {
  const d = await run(`p-${p.codigoProducto}`, () => service.product(p.codigoProducto))
  if (!d) return
  editingProduct.value = d.codigoProducto
  Object.assign(pForm, { idCategoria: d.idCategoria, codigoProducto: d.codigoProducto, nombre: d.nombre, descripcion: d.descripcion ?? '', precioBase: d.precioBase, permitePersonalizacion: d.permitePersonalizacion })
  productDialog.value = true
}

async function saveProduct(): Promise<void> {
  if (!pValid.value) return
  const body = { idCategoria: pForm.idCategoria, nombre: pForm.nombre.trim(), descripcion: pForm.descripcion.trim() || null, precioBase: Number(pForm.precioBase), permitePersonalizacion: pForm.permitePersonalizacion }
  const ok = editingProduct.value
    ? await run('save-p', () => service.updateProduct(editingProduct.value!, body), 'Producto actualizado.')
    : await run('save-p', () => service.createProduct({ ...body, codigoProducto: pForm.codigoProducto.trim().toUpperCase() }), 'Producto creado.')
  if (ok !== null) {
    productDialog.value = false
    products.value = await service.products()
  }
}

async function toggleProduct(p: AdminProductSummary): Promise<void> {
  if (p.activo && !(await confirm({ title: `¿Ocultar "${p.nombre}" del catálogo?`, message: 'Los compradores dejarán de verlo. Puedes activarlo de nuevo.', confirmText: 'Desactivar', danger: true }))) return
  const ok = await run(`p-${p.codigoProducto}`, () => service.setProductActive(p.codigoProducto, !p.activo), p.activo ? 'Producto desactivado.' : 'Producto activado.')
  if (ok !== null) products.value = await service.products()
}

/* ---------- Variantes ---------- */
const variantsDialog = ref(false)
const detail = ref<AdminProductDetail | null>(null)
const variantForm = ref(false)
const editingVariant = ref<AdminVariant | null>(null)
const vForm = reactive({ codigoVariante: '', nombre: '', descripcion: '', precioAdicional: 0, formaLienzo: 'CIRCULAR' as CanvasShape })
const vValid = computed(() => vForm.nombre.trim().length > 0 && (!!editingVariant.value || /^[A-Z0-9-]{3,40}$/i.test(vForm.codigoVariante.trim())))

async function openVariants(p: AdminProductSummary): Promise<void> {
  const d = await run(`p-${p.codigoProducto}`, () => service.product(p.codigoProducto))
  if (!d) return
  detail.value = d
  variantForm.value = false
  variantsDialog.value = true
}

function newVariant(): void {
  editingVariant.value = null
  Object.assign(vForm, { codigoVariante: `${detail.value?.codigoProducto ?? ''}-`, nombre: '', descripcion: '', precioAdicional: 0, formaLienzo: 'CIRCULAR' })
  variantForm.value = true
}

function editVariant(v: AdminVariant): void {
  editingVariant.value = v
  Object.assign(vForm, { codigoVariante: v.codigoVariante, nombre: v.nombre, descripcion: v.descripcion ?? '', precioAdicional: v.precioAdicional, formaLienzo: v.formaLienzo ?? 'CIRCULAR' })
  variantForm.value = true
}

async function refreshDetail(): Promise<void> {
  if (!detail.value) return
  detail.value = await service.product(detail.value.codigoProducto)
  products.value = await service.products()
}

async function saveVariant(): Promise<void> {
  if (!vValid.value || !detail.value) return
  const forma = detail.value.permitePersonalizacion ? vForm.formaLienzo : null
  const body = { nombre: vForm.nombre.trim(), descripcion: vForm.descripcion.trim() || null, precioAdicional: Number(vForm.precioAdicional), formaLienzo: forma }
  const codigo = detail.value.codigoProducto
  const ok = editingVariant.value
    ? await run('save-v', () => service.updateVariant(editingVariant.value!.idVariante, body), 'Variante actualizada.')
    : await run('save-v', () => service.createVariant(codigo, { ...body, codigoVariante: vForm.codigoVariante.trim().toUpperCase() }), 'Variante creada.')
  if (ok !== null) {
    variantForm.value = false
    await refreshDetail()
  }
}

async function toggleVariant(v: AdminVariant): Promise<void> {
  const ok = await run(`v-${v.idVariante}`, () => service.setVariantActive(v.idVariante, !v.activo), v.activo ? 'Variante desactivada.' : 'Variante activada.')
  if (ok !== null) await refreshDetail()
}

/* ---------- Categorías y áreas (mismo formulario: nombre + descripción) ---------- */
const namedDialog = ref(false)
const namedKind = ref<'categoria' | 'area'>('categoria')
const namedId = ref<number | null>(null)
const nForm = reactive({ nombre: '', descripcion: '' })

function openNamed(kind: 'categoria' | 'area', item?: AdminCategory | AdminArea): void {
  namedKind.value = kind
  namedId.value = item ? ('idCategoria' in item ? item.idCategoria : item.idAreaEntrega) : null
  Object.assign(nForm, { nombre: item?.nombre ?? '', descripcion: item?.descripcion ?? '' })
  namedDialog.value = true
}

async function saveNamed(): Promise<void> {
  if (!nForm.nombre.trim()) return
  const body = { nombre: nForm.nombre.trim(), descripcion: nForm.descripcion.trim() || null }
  const id = namedId.value
  const isCat = namedKind.value === 'categoria'
  const action = isCat
    ? () => (id ? service.updateCategory(id, body) : service.createCategory(body))
    : () => (id ? service.updateArea(id, body) : service.createArea(body))
  const ok = await run('save-n', action, id ? 'Cambios guardados.' : isCat ? 'Categoría creada.' : 'Área creada.')
  if (ok !== null) {
    namedDialog.value = false
    if (isCat) categories.value = await service.categories()
    else areas.value = await service.areas()
  }
}

async function toggleCategory(c: AdminCategory): Promise<void> {
  const ok = await run(`c-${c.idCategoria}`, () => service.setCategoryActive(c.idCategoria, !c.activo), c.activo ? 'Categoría desactivada.' : 'Categoría activada.')
  if (ok !== null) categories.value = await service.categories()
}

async function toggleArea(a: AdminArea): Promise<void> {
  const ok = await run(`a-${a.idAreaEntrega}`, () => service.setAreaActive(a.idAreaEntrega, !a.activo), a.activo ? 'Área desactivada.' : 'Área activada.')
  if (ok !== null) areas.value = await service.areas()
}

onMounted(loadAll)
</script>

<template>
  <div>
    <div class="d-flex flex-wrap align-center ga-3 mb-4">
      <v-btn-toggle
        v-model="section"
        mandatory
        density="compact"
        variant="outlined"
        color="accent"
      >
        <v-btn
          value="productos"
          class="text-none"
          prepend-icon="mdi-package-variant"
        >
          Productos
        </v-btn>
        <v-btn
          value="categorias"
          class="text-none"
          prepend-icon="mdi-shape-outline"
        >
          Categorías
        </v-btn>
        <v-btn
          value="areas"
          class="text-none"
          prepend-icon="mdi-map-marker-radius-outline"
        >
          Áreas de entrega
        </v-btn>
      </v-btn-toggle>
      <v-spacer />
      <v-btn
        v-if="section === 'productos'"
        color="primary"
        class="text-none"
        prepend-icon="mdi-plus"
        :disabled="activeCategories.length === 0"
        @click="newProduct"
      >
        Nuevo producto
      </v-btn>
      <v-btn
        v-else
        color="primary"
        class="text-none"
        prepend-icon="mdi-plus"
        @click="openNamed(section === 'categorias' ? 'categoria' : 'area')"
      >
        {{ section === 'categorias' ? 'Nueva categoría' : 'Nueva área' }}
      </v-btn>
    </div>

    <div class="panel">
      <v-progress-linear
        v-if="loading"
        indeterminate
        color="accent"
      />

      <!-- Productos -->
      <v-table
        v-if="section === 'productos'"
        class="bg-transparent"
      >
        <thead>
          <tr>
            <th>Producto</th>
            <th class="d-none d-md-table-cell">
              Categoría
            </th>
            <th>Precio base</th>
            <th class="d-none d-sm-table-cell">
              Variantes
            </th>
            <th>Estado</th>
            <th class="text-right">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="p in products"
            :key="p.codigoProducto"
            :class="{ 'row--off': !p.activo }"
          >
            <td>
              <div class="font-weight-bold">
                {{ p.nombre }}
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ p.codigoProducto }}<span v-if="p.permitePersonalizacion"> · Personalizable</span>
              </div>
            </td>
            <td class="d-none d-md-table-cell">
              {{ p.categoria }}
            </td>
            <td>{{ formatQ(p.precioBase) }}</td>
            <td class="d-none d-sm-table-cell">
              {{ p.variantesActivas }} activas
            </td>
            <td>
              <v-chip
                size="x-small"
                variant="tonal"
                :color="p.activo ? 'success' : undefined"
              >
                {{ p.activo ? 'Visible' : 'Oculto' }}
              </v-chip>
            </td>
            <td class="text-right text-no-wrap">
              <v-btn
                size="small"
                variant="text"
                class="text-none"
                prepend-icon="mdi-layers-outline"
                :loading="busy === `p-${p.codigoProducto}`"
                @click="openVariants(p)"
              >
                Variantes
              </v-btn>
              <v-btn
                icon="mdi-pencil-outline"
                size="small"
                variant="text"
                :aria-label="`Editar ${p.nombre}`"
                @click="editProduct(p)"
              />
              <v-btn
                :icon="p.activo ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                size="small"
                variant="text"
                :aria-label="p.activo ? 'Desactivar' : 'Activar'"
                @click="toggleProduct(p)"
              />
            </td>
          </tr>
          <tr v-if="!loading && products.length === 0">
            <td
              colspan="6"
              class="text-center text-medium-emphasis py-8"
            >
              Aún no hay productos.
            </td>
          </tr>
        </tbody>
      </v-table>

      <!-- Categorías / Áreas -->
      <v-table
        v-else
        class="bg-transparent"
      >
        <thead>
          <tr>
            <th>Nombre</th>
            <th class="d-none d-sm-table-cell">
              Descripción
            </th>
            <th>Estado</th>
            <th class="text-right">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody v-if="section === 'categorias'">
          <tr
            v-for="c in categories"
            :key="c.idCategoria"
            :class="{ 'row--off': !c.activo }"
          >
            <td class="font-weight-bold">
              {{ c.nombre }}
            </td>
            <td class="d-none d-sm-table-cell text-medium-emphasis">
              {{ c.descripcion ?? '—' }}
            </td>
            <td>
              <v-chip
                size="x-small"
                variant="tonal"
                :color="c.activo ? 'success' : undefined"
              >
                {{ c.activo ? 'Activa' : 'Inactiva' }}
              </v-chip>
            </td>
            <td class="text-right text-no-wrap">
              <v-btn
                icon="mdi-pencil-outline"
                size="small"
                variant="text"
                aria-label="Editar"
                @click="openNamed('categoria', c)"
              />
              <v-btn
                :icon="c.activo ? 'mdi-toggle-switch' : 'mdi-toggle-switch-off-outline'"
                size="small"
                variant="text"
                :color="c.activo ? 'success' : undefined"
                :loading="busy === `c-${c.idCategoria}`"
                :aria-label="c.activo ? 'Desactivar' : 'Activar'"
                @click="toggleCategory(c)"
              />
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr
            v-for="a in areas"
            :key="a.idAreaEntrega"
            :class="{ 'row--off': !a.activo }"
          >
            <td class="font-weight-bold">
              {{ a.nombre }}
            </td>
            <td class="d-none d-sm-table-cell text-medium-emphasis">
              {{ a.descripcion ?? '—' }}
            </td>
            <td>
              <v-chip
                size="x-small"
                variant="tonal"
                :color="a.activo ? 'success' : undefined"
              >
                {{ a.activo ? 'Activa' : 'Inactiva' }}
              </v-chip>
            </td>
            <td class="text-right text-no-wrap">
              <v-btn
                icon="mdi-pencil-outline"
                size="small"
                variant="text"
                aria-label="Editar"
                @click="openNamed('area', a)"
              />
              <v-btn
                :icon="a.activo ? 'mdi-toggle-switch' : 'mdi-toggle-switch-off-outline'"
                size="small"
                variant="text"
                :color="a.activo ? 'success' : undefined"
                :loading="busy === `a-${a.idAreaEntrega}`"
                :aria-label="a.activo ? 'Desactivar' : 'Activar'"
                @click="toggleArea(a)"
              />
            </td>
          </tr>
        </tbody>
      </v-table>
    </div>

    <!-- Producto -->
    <v-dialog
      v-model="productDialog"
      max-width="540"
    >
      <v-card
        rounded="lg"
        border
      >
        <v-card-title class="pt-5 px-6">
          {{ editingProduct ? 'Editar producto' : 'Nuevo producto' }}
        </v-card-title>
        <v-card-text class="px-6">
          <v-text-field
            v-model="pForm.codigoProducto"
            label="Código"
            variant="outlined"
            hint="Ej.: LLV-002. No se puede cambiar después."
            persistent-hint
            :disabled="!!editingProduct"
            class="mb-3"
          />
          <v-text-field
            v-model="pForm.nombre"
            label="Nombre"
            variant="outlined"
          />
          <v-textarea
            v-model="pForm.descripcion"
            label="Descripción"
            variant="outlined"
            rows="2"
            auto-grow
          />
          <div class="d-flex ga-3">
            <v-select
              v-model="pForm.idCategoria"
              :items="activeCategories"
              item-title="nombre"
              item-value="idCategoria"
              label="Categoría"
              variant="outlined"
            />
            <v-text-field
              v-model.number="pForm.precioBase"
              label="Precio base (Q)"
              type="number"
              min="0"
              step="0.5"
              variant="outlined"
            />
          </div>
          <v-switch
            v-model="pForm.permitePersonalizacion"
            color="accent"
            label="Permite personalización (Lado A y Lado B)"
            hide-details
          />
        </v-card-text>
        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn
            variant="text"
            class="text-none"
            @click="productDialog = false"
          >
            Cancelar
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            class="text-none"
            :disabled="!pValid"
            :loading="busy === 'save-p'"
            @click="saveProduct"
          >
            Guardar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Variantes -->
    <v-dialog
      v-model="variantsDialog"
      max-width="720"
      scrollable
    >
      <v-card
        v-if="detail"
        rounded="lg"
        border
      >
        <v-card-title class="d-flex align-center pt-5 px-6">
          Variantes de {{ detail.nombre }}
          <v-spacer />
          <v-btn
            icon="mdi-close"
            variant="text"
            size="small"
            aria-label="Cerrar"
            @click="variantsDialog = false"
          />
        </v-card-title>
        <v-card-text class="px-6">
          <v-table
            density="comfortable"
            class="bg-transparent mb-4"
          >
            <thead>
              <tr>
                <th>Variante</th>
                <th v-if="detail.permitePersonalizacion">
                  Forma
                </th>
                <th>Precio</th>
                <th class="text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="v in detail.variantes"
                :key="v.idVariante"
                :class="{ 'row--off': !v.activo }"
              >
                <td>
                  <div class="font-weight-bold">
                    {{ v.nombre }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    {{ v.codigoVariante }}
                  </div>
                </td>
                <td v-if="detail.permitePersonalizacion">
                  {{ v.formaLienzo === 'CUADRADA' ? 'Cuadrada' : 'Circular' }}
                </td>
                <td>
                  {{ formatQ(v.precioActual) }}
                  <div
                    v-if="v.precioAdicional"
                    class="text-caption text-medium-emphasis"
                  >
                    +{{ formatQ(v.precioAdicional) }}
                  </div>
                </td>
                <td class="text-right text-no-wrap">
                  <v-btn
                    icon="mdi-pencil-outline"
                    size="small"
                    variant="text"
                    aria-label="Editar variante"
                    @click="editVariant(v)"
                  />
                  <v-btn
                    :icon="v.activo ? 'mdi-toggle-switch' : 'mdi-toggle-switch-off-outline'"
                    size="small"
                    variant="text"
                    :color="v.activo ? 'success' : undefined"
                    :loading="busy === `v-${v.idVariante}`"
                    :aria-label="v.activo ? 'Desactivar' : 'Activar'"
                    @click="toggleVariant(v)"
                  />
                </td>
              </tr>
              <tr v-if="detail.variantes.length === 0">
                <td
                  colspan="4"
                  class="text-center text-medium-emphasis py-6"
                >
                  Sin variantes. Agrega al menos una para que se pueda vender.
                </td>
              </tr>
            </tbody>
          </v-table>

          <v-expand-transition>
            <div
              v-if="variantForm"
              class="variant-form"
            >
              <div class="font-weight-bold mb-3">
                {{ editingVariant ? 'Editar variante' : 'Nueva variante' }}
              </div>
              <div class="d-flex flex-wrap ga-3">
                <v-text-field
                  v-model="vForm.codigoVariante"
                  label="Código"
                  variant="outlined"
                  density="comfortable"
                  :disabled="!!editingVariant"
                  style="min-width: 180px"
                />
                <v-text-field
                  v-model="vForm.nombre"
                  label="Nombre"
                  variant="outlined"
                  density="comfortable"
                  style="min-width: 180px"
                />
              </div>
              <div class="d-flex flex-wrap ga-3">
                <v-text-field
                  v-model.number="vForm.precioAdicional"
                  label="Precio adicional (Q)"
                  type="number"
                  step="0.5"
                  variant="outlined"
                  density="comfortable"
                  :hint="`Precio final: ${formatQ(detail.precioBase + Number(vForm.precioAdicional || 0))}`"
                  persistent-hint
                />
                <v-select
                  v-if="detail.permitePersonalizacion"
                  v-model="vForm.formaLienzo"
                  :items="SHAPES"
                  label="Forma del lienzo"
                  variant="outlined"
                  density="comfortable"
                />
              </div>
              <div class="d-flex justify-end ga-2 mt-2">
                <v-btn
                  variant="text"
                  class="text-none"
                  @click="variantForm = false"
                >
                  Cancelar
                </v-btn>
                <v-btn
                  color="primary"
                  variant="flat"
                  class="text-none"
                  :disabled="!vValid"
                  :loading="busy === 'save-v'"
                  @click="saveVariant"
                >
                  Guardar variante
                </v-btn>
              </div>
            </div>
          </v-expand-transition>
        </v-card-text>
        <v-card-actions
          v-if="!variantForm"
          class="px-6 pb-5"
        >
          <v-btn
            color="primary"
            variant="tonal"
            class="text-none"
            prepend-icon="mdi-plus"
            @click="newVariant"
          >
            Agregar variante
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Categoría / Área -->
    <v-dialog
      v-model="namedDialog"
      max-width="460"
    >
      <v-card
        rounded="lg"
        border
      >
        <v-card-title class="pt-5 px-6">
          {{ namedId ? 'Editar' : 'Nueva' }} {{ namedKind === 'categoria' ? 'categoría' : 'área de entrega' }}
        </v-card-title>
        <v-card-text class="px-6">
          <v-text-field
            v-model="nForm.nombre"
            label="Nombre"
            variant="outlined"
          />
          <v-textarea
            v-model="nForm.descripcion"
            :label="namedKind === 'area' ? 'Descripción (ej.: segundo nivel, junto a la caja)' : 'Descripción'"
            variant="outlined"
            rows="2"
            auto-grow
          />
        </v-card-text>
        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn
            variant="text"
            class="text-none"
            @click="namedDialog = false"
          >
            Cancelar
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            class="text-none"
            :disabled="!nForm.nombre.trim()"
            :loading="busy === 'save-n'"
            @click="saveNamed"
          >
            Guardar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.panel {
  border-radius: 16px;
  border: 1px solid rgb(148 163 184 / 25%);
  background: rgb(30 41 59 / 92%);
  overflow: hidden;
}

.row--off {
  opacity: 0.55;
}

.variant-form {
  padding: 16px;
  border-radius: 12px;
  border: 1px solid rgb(6 182 212 / 40%);
  background: rgb(15 23 42 / 50%);
}
</style>
