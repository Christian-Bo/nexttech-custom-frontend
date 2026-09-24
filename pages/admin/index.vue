<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { AuditEntry, InternalRoleInfo, InternalUser, PagedResult } from '~/features/admin/types/admin'
import { generateTemporaryPassword, useAdminService } from '~/features/admin/services/adminService'
import { isApiError } from '~/services/api'
import type { ApiError } from '~/types/api'
import { formatDateTime, timeAgo } from '~/utils/format'
import AdminCatalogPanel from '~/features/admin/components/AdminCatalogPanel.vue'

/** Administración del personal interno (solo ADMIN; el backend responde 403 a cualquier otro rol). */
definePageMeta({ middleware: 'admin' })
useHead({ title: 'Administración · NextTech Custom' })

const service = useAdminService()
const snackbar = useSnackbar()
const { confirm } = useConfirm()

const tab = ref<'usuarios' | 'catalogo' | 'auditoria'>('usuarios')
const roles = ref<InternalRoleInfo[]>([])

const ROLE_ICONS: Record<string, string> = {
  ADMIN: 'mdi-shield-crown-outline',
  SUPERVISOR: 'mdi-account-tie-outline',
  REPARTIDOR: 'mdi-moped-outline'
}

/* ---------------- Usuarios ---------------- */
const filters = reactive({ search: '', roleCode: '' as string, status: 'todos' as 'todos' | 'activos' | 'inactivos' | 'bloqueados' })
const pageNum = ref(1)
const PAGE_SIZE = 10
const result = ref<PagedResult<InternalUser> | null>(null)
const loading = ref(true)
const error = ref<ApiError | null>(null)
const busyId = ref<number | null>(null)

const STATUS_OPTIONS = [
  { value: 'todos', title: 'Todos' },
  { value: 'activos', title: 'Activos' },
  { value: 'inactivos', title: 'Inactivos' },
  { value: 'bloqueados', title: 'Bloqueados' }
]

const summary = computed(() => {
  const items = result.value?.items ?? []
  return {
    total: result.value?.totalItems ?? 0,
    locked: items.filter(u => u.isLocked).length,
    pending: items.filter(u => u.mustChangePassword).length
  }
})

async function loadUsers(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    result.value = await service.users({
      search: filters.search.trim() || undefined,
      roleCode: filters.roleCode || undefined,
      isActive: filters.status === 'activos' ? true : filters.status === 'inactivos' ? false : undefined,
      isLocked: filters.status === 'bloqueados' ? true : undefined,
      page: pageNum.value,
      pageSize: PAGE_SIZE
    })
  }
  catch (e) {
    error.value = isApiError(e) ? e : { status: 0, code: 'UNKNOWN', message: 'No se pudieron cargar los usuarios.' }
  }
  finally {
    loading.value = false
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(() => filters.search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    pageNum.value = 1
    void loadUsers()
  }, 350)
})
watch(() => [filters.roleCode, filters.status], () => {
  pageNum.value = 1
  void loadUsers()
})
watch(pageNum, () => void loadUsers())

/* Crear / editar */
const dialog = ref(false)
const editing = ref<InternalUser | null>(null)
const form = reactive({ firstName: '', lastName: '', email: '', roleCode: 'REPARTIDOR', temporaryPassword: '' })
const saving = ref(false)
const formRules = {
  required: (v: string) => !!v?.trim() || 'Obligatorio.',
  email: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) || 'Correo no válido.',
  password: (v: string) => (v.length >= 8 && /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v)) || 'Mínimo 8, con mayúscula, minúscula y número.'
}
const formValid = computed(() =>
  formRules.required(form.firstName) === true && formRules.required(form.lastName) === true
  && formRules.email(form.email) === true && !!form.roleCode
  && (!!editing.value || formRules.password(form.temporaryPassword) === true)
)

function openCreate(): void {
  editing.value = null
  Object.assign(form, { firstName: '', lastName: '', email: '', roleCode: 'REPARTIDOR', temporaryPassword: generateTemporaryPassword() })
  dialog.value = true
}

function openEdit(u: InternalUser): void {
  editing.value = u
  Object.assign(form, { firstName: u.firstName, lastName: u.lastName, email: u.email, roleCode: u.role.code, temporaryPassword: '' })
  dialog.value = true
}

/** Contraseña temporal que se muestra una sola vez para entregarla al usuario. */
const shownPassword = ref<{ user: string, password: string } | null>(null)

async function save(): Promise<void> {
  if (!formValid.value) return
  saving.value = true
  try {
    const body = { firstName: form.firstName, lastName: form.lastName, email: form.email.trim(), roleCode: form.roleCode }
    if (editing.value) {
      await service.update(editing.value.id, body)
      snackbar.success('Usuario actualizado.')
    }
    else {
      const created = await service.create({ ...body, temporaryPassword: form.temporaryPassword })
      shownPassword.value = { user: created.email, password: form.temporaryPassword }
    }
    dialog.value = false
    await loadUsers()
  }
  catch (e) {
    snackbar.error(isApiError(e) ? e : 'No se pudo guardar el usuario.')
  }
  finally {
    saving.value = false
  }
}

async function run(u: InternalUser, action: () => Promise<unknown>, ok: string): Promise<void> {
  busyId.value = u.id
  try {
    await action()
    snackbar.success(ok)
    await loadUsers()
  }
  catch (e) {
    snackbar.error(isApiError(e) ? e : 'No se pudo completar la acción.')
  }
  finally {
    busyId.value = null
  }
}

async function toggleActive(u: InternalUser): Promise<void> {
  if (u.isActive) {
    const yes = await confirm({ title: `¿Desactivar a ${u.fullName}?`, message: 'Ya no podrá iniciar sesión. Puedes reactivarlo cuando quieras.', confirmText: 'Desactivar', danger: true })
    if (yes) await run(u, () => service.deactivate(u.id), 'Usuario desactivado.')
  }
  else {
    await run(u, () => service.activate(u.id), 'Usuario activado.')
  }
}

async function unlock(u: InternalUser): Promise<void> {
  await run(u, () => service.unlock(u.id), 'Usuario desbloqueado.')
}

async function resetPassword(u: InternalUser): Promise<void> {
  const yes = await confirm({ title: `¿Restablecer la contraseña de ${u.fullName}?`, message: 'Se generará una contraseña temporal y deberá cambiarla al ingresar.', confirmText: 'Restablecer' })
  if (!yes) return
  const temporary = generateTemporaryPassword()
  busyId.value = u.id
  try {
    await service.resetPassword(u.id, temporary)
    shownPassword.value = { user: u.email, password: temporary }
    await loadUsers()
  }
  catch (e) {
    snackbar.error(isApiError(e) ? e : 'No se pudo restablecer la contraseña.')
  }
  finally {
    busyId.value = null
  }
}

async function copyPassword(): Promise<void> {
  if (!shownPassword.value) return
  try {
    await navigator.clipboard.writeText(shownPassword.value.password)
    snackbar.success('Contraseña copiada.')
  }
  catch {
    snackbar.info('Cópiala manualmente.')
  }
}

/* ---------------- Auditoría ---------------- */
const auditResult = ref<PagedResult<AuditEntry> | null>(null)
const auditFilter = ref<'' | 'EXITOSO' | 'FALLIDO'>('')
const auditPage = ref(1)
const auditLoading = ref(false)
const auditError = ref<ApiError | null>(null)

async function loadAudit(): Promise<void> {
  auditLoading.value = true
  auditError.value = null
  try {
    auditResult.value = await service.audit({ result: auditFilter.value || undefined, page: auditPage.value, pageSize: 20 })
  }
  catch (e) {
    auditError.value = isApiError(e) ? e : { status: 0, code: 'UNKNOWN', message: 'No se pudo cargar la auditoría.' }
  }
  finally {
    auditLoading.value = false
  }
}

watch([auditFilter, auditPage], () => void loadAudit())
watch(tab, (t) => {
  if (t === 'auditoria' && !auditResult.value) void loadAudit()
})

function actionLabel(a: string): string {
  return a.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())
}

function isSuccess(r: string): boolean {
  return /^(success|ok|exito|éxito|exitoso)$/i.test(r)
}

onMounted(async () => {
  try {
    roles.value = await service.roles()
  }
  catch {
    roles.value = []
  }
  await loadUsers()
})
</script>

<template>
  <v-container
    fluid
    class="py-6 px-4 px-md-8"
    style="max-width: 1300px"
  >
    <div class="d-flex flex-wrap align-center ga-3 mb-6">
      <div>
        <h1 class="text-h5 font-weight-bold">
          Administración
        </h1>
        <div class="text-caption text-medium-emphasis">
          Personal interno, catálogo y registro de actividad
        </div>
      </div>
      <v-spacer />
      <v-btn
        to="/panel"
        variant="tonal"
        class="text-none"
        prepend-icon="mdi-view-dashboard-outline"
      >
        Dashboard
      </v-btn>
      <v-btn
        to="/panel/produccion"
        variant="tonal"
        class="text-none"
        prepend-icon="mdi-hammer-wrench"
      >
        Producción
      </v-btn>
    </div>

    <v-tabs
      v-model="tab"
      color="accent"
      class="mb-6"
    >
      <v-tab
        value="usuarios"
        prepend-icon="mdi-account-group-outline"
        class="text-none"
      >
        Usuarios
      </v-tab>
      <v-tab
        value="catalogo"
        prepend-icon="mdi-storefront-outline"
        class="text-none"
      >
        Catálogo
      </v-tab>
      <v-tab
        value="auditoria"
        prepend-icon="mdi-history"
        class="text-none"
      >
        Auditoría
      </v-tab>
    </v-tabs>

    <!-- ================= USUARIOS ================= -->
    <template v-if="tab === 'usuarios'">
      <div class="toolbar mb-4">
        <v-text-field
          v-model="filters.search"
          placeholder="Buscar por nombre o correo"
          prepend-inner-icon="mdi-magnify"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          class="toolbar__search"
        />
        <v-select
          v-model="filters.roleCode"
          :items="[{ code: '', name: 'Todos los roles' }, ...roles]"
          item-title="name"
          item-value="code"
          density="compact"
          variant="outlined"
          hide-details
          class="toolbar__select"
          aria-label="Rol"
        />
        <v-select
          v-model="filters.status"
          :items="STATUS_OPTIONS"
          density="compact"
          variant="outlined"
          hide-details
          class="toolbar__select"
          aria-label="Estado"
        />
        <v-spacer />
        <v-btn
          color="primary"
          class="text-none"
          prepend-icon="mdi-account-plus-outline"
          @click="openCreate"
        >
          Nuevo usuario
        </v-btn>
      </div>

      <div
        v-if="result"
        class="d-flex flex-wrap ga-2 mb-4"
      >
        <v-chip
          size="small"
          variant="tonal"
        >
          {{ summary.total }} usuarios
        </v-chip>
        <v-chip
          v-if="summary.locked"
          size="small"
          variant="tonal"
          color="error"
          prepend-icon="mdi-lock-outline"
        >
          {{ summary.locked }} bloqueados en esta página
        </v-chip>
        <v-chip
          v-if="summary.pending"
          size="small"
          variant="tonal"
          color="warning"
          prepend-icon="mdi-key-alert-outline"
        >
          {{ summary.pending }} deben cambiar contraseña
        </v-chip>
      </div>

      <StateError
        v-if="error"
        :error="error"
        @retry="loadUsers"
      />

      <div
        v-else
        class="panel"
      >
        <v-progress-linear
          v-if="loading"
          indeterminate
          color="accent"
        />
        <v-table class="bg-transparent">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Estado</th>
              <th class="d-none d-md-table-cell">
                Último acceso
              </th>
              <th class="text-right">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="u in result?.items ?? []"
              :key="u.id"
              :class="{ 'row--off': !u.isActive }"
            >
              <td>
                <div class="d-flex align-center ga-3 py-2">
                  <v-avatar
                    size="36"
                    color="primary"
                    variant="tonal"
                  >
                    {{ (u.firstName[0] ?? '') + (u.lastName[0] ?? '') }}
                  </v-avatar>
                  <div>
                    <div class="font-weight-bold">
                      {{ u.fullName }}
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      {{ u.email }}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <v-chip
                  size="small"
                  variant="tonal"
                  :prepend-icon="ROLE_ICONS[u.role.code] ?? 'mdi-account-outline'"
                >
                  {{ u.role.name }}
                </v-chip>
              </td>
              <td>
                <div class="d-flex flex-wrap ga-1">
                  <v-chip
                    size="x-small"
                    :color="u.isActive ? 'success' : undefined"
                    variant="tonal"
                  >
                    {{ u.isActive ? 'Activo' : 'Inactivo' }}
                  </v-chip>
                  <v-chip
                    v-if="u.isLocked"
                    size="x-small"
                    color="error"
                    variant="tonal"
                    prepend-icon="mdi-lock-outline"
                  >
                    Bloqueado
                  </v-chip>
                  <v-chip
                    v-if="u.mustChangePassword"
                    size="x-small"
                    color="warning"
                    variant="tonal"
                  >
                    Contraseña temporal
                  </v-chip>
                </div>
              </td>
              <td class="d-none d-md-table-cell text-medium-emphasis">
                <span
                  v-if="u.lastAccessUtc"
                  :title="formatDateTime(u.lastAccessUtc)"
                >{{ timeAgo(u.lastAccessUtc) }}</span>
                <span v-else>Nunca</span>
              </td>
              <td class="text-right">
                <v-menu location="bottom end">
                  <template #activator="{ props }">
                    <v-btn
                      v-bind="props"
                      icon="mdi-dots-vertical"
                      variant="text"
                      size="small"
                      :loading="busyId === u.id"
                      :aria-label="`Acciones para ${u.fullName}`"
                    />
                  </template>
                  <v-list density="compact">
                    <v-list-item
                      prepend-icon="mdi-pencil-outline"
                      title="Editar"
                      @click="openEdit(u)"
                    />
                    <v-list-item
                      prepend-icon="mdi-lock-reset"
                      title="Restablecer contraseña"
                      @click="resetPassword(u)"
                    />
                    <v-list-item
                      v-if="u.isLocked"
                      prepend-icon="mdi-lock-open-variant-outline"
                      title="Desbloquear"
                      @click="unlock(u)"
                    />
                    <v-divider />
                    <v-list-item
                      :prepend-icon="u.isActive ? 'mdi-account-off-outline' : 'mdi-account-check-outline'"
                      :title="u.isActive ? 'Desactivar' : 'Activar'"
                      :class="{ 'text-error': u.isActive }"
                      @click="toggleActive(u)"
                    />
                  </v-list>
                </v-menu>
              </td>
            </tr>
            <tr v-if="!loading && (result?.items.length ?? 0) === 0">
              <td
                colspan="5"
                class="text-center text-medium-emphasis py-8"
              >
                No hay usuarios con esos filtros.
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>

      <div
        v-if="result && result.totalPages > 1"
        class="d-flex justify-center mt-4"
      >
        <v-pagination
          v-model="pageNum"
          :length="result.totalPages"
          density="comfortable"
          rounded
        />
      </div>
    </template>

    <!-- ================= CATÁLOGO ================= -->
    <AdminCatalogPanel v-else-if="tab === 'catalogo'" />

    <!-- ================= AUDITORÍA ================= -->
    <template v-else>
      <div class="toolbar mb-4">
        <v-btn-toggle
          v-model="auditFilter"
          mandatory
          density="compact"
          variant="outlined"
          color="accent"
        >
          <v-btn
            value=""
            class="text-none"
          >
            Todo
          </v-btn>
          <v-btn
            value="EXITOSO"
            class="text-none"
          >
            Exitosos
          </v-btn>
          <v-btn
            value="FALLIDO"
            class="text-none"
          >
            Fallidos
          </v-btn>
        </v-btn-toggle>
        <v-spacer />
        <v-btn
          variant="text"
          class="text-none"
          prepend-icon="mdi-refresh"
          :loading="auditLoading"
          @click="loadAudit"
        >
          Actualizar
        </v-btn>
      </div>

      <StateError
        v-if="auditError"
        :error="auditError"
        @retry="loadAudit"
      />

      <div
        v-else
        class="panel"
      >
        <v-progress-linear
          v-if="auditLoading"
          indeterminate
          color="accent"
        />
        <v-table class="bg-transparent">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Quién</th>
              <th>Acción</th>
              <th class="d-none d-md-table-cell">
                Sobre
              </th>
              <th>Resultado</th>
              <th class="d-none d-lg-table-cell">
                IP
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="a in auditResult?.items ?? []"
              :key="a.id"
            >
              <td class="text-no-wrap">
                {{ formatDateTime(a.occurredAtUtc) }}
              </td>
              <td>
                <div>{{ a.internalUserName ?? (a.buyerId ? `Comprador #${a.buyerId}` : 'Sistema') }}</div>
                <div
                  v-if="a.roleName"
                  class="text-caption text-medium-emphasis"
                >
                  {{ a.roleName }}
                </div>
              </td>
              <td>{{ actionLabel(a.action) }}</td>
              <td class="d-none d-md-table-cell text-medium-emphasis">
                {{ a.entityDisplayName ?? a.entity }}
              </td>
              <td>
                <v-chip
                  size="x-small"
                  variant="tonal"
                  :color="isSuccess(a.result) ? 'success' : 'error'"
                >
                  {{ isSuccess(a.result) ? 'Éxito' : a.result }}
                </v-chip>
              </td>
              <td class="d-none d-lg-table-cell text-medium-emphasis">
                {{ a.ipAddress ?? '—' }}
              </td>
            </tr>
            <tr v-if="!auditLoading && (auditResult?.items.length ?? 0) === 0">
              <td
                colspan="6"
                class="text-center text-medium-emphasis py-8"
              >
                Sin registros.
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>

      <div
        v-if="auditResult && auditResult.totalPages > 1"
        class="d-flex justify-center mt-4"
      >
        <v-pagination
          v-model="auditPage"
          :length="auditResult.totalPages"
          density="comfortable"
          rounded
        />
      </div>
    </template>

    <!-- Crear / editar usuario -->
    <v-dialog
      v-model="dialog"
      max-width="520"
    >
      <v-card
        rounded="lg"
        border
      >
        <v-card-title class="pt-5 px-6">
          {{ editing ? 'Editar usuario' : 'Nuevo usuario' }}
        </v-card-title>
        <v-card-text class="px-6">
          <v-form @submit.prevent="save">
            <div class="d-flex ga-3">
              <v-text-field
                v-model="form.firstName"
                label="Nombres"
                variant="outlined"
                :rules="[formRules.required]"
              />
              <v-text-field
                v-model="form.lastName"
                label="Apellidos"
                variant="outlined"
                :rules="[formRules.required]"
              />
            </div>
            <v-text-field
              v-model="form.email"
              label="Correo"
              type="email"
              variant="outlined"
              prepend-inner-icon="mdi-email-outline"
              :rules="[formRules.required, formRules.email]"
            />
            <v-select
              v-model="form.roleCode"
              :items="roles"
              item-title="name"
              item-value="code"
              label="Rol"
              variant="outlined"
              prepend-inner-icon="mdi-shield-account-outline"
            />
            <v-text-field
              v-if="!editing"
              v-model="form.temporaryPassword"
              label="Contraseña temporal"
              variant="outlined"
              prepend-inner-icon="mdi-key-outline"
              append-inner-icon="mdi-dice-multiple-outline"
              hint="Deberá cambiarla la primera vez que ingrese."
              persistent-hint
              :rules="[formRules.password]"
              @click:append-inner="form.temporaryPassword = generateTemporaryPassword()"
            />
          </v-form>
        </v-card-text>
        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn
            variant="text"
            class="text-none"
            @click="dialog = false"
          >
            Cancelar
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            class="text-none"
            :loading="saving"
            :disabled="!formValid"
            @click="save"
          >
            {{ editing ? 'Guardar' : 'Crear usuario' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Contraseña temporal (se muestra una vez) -->
    <v-dialog
      :model-value="!!shownPassword"
      max-width="440"
      persistent
    >
      <v-card
        v-if="shownPassword"
        rounded="lg"
        border
        class="pa-6 text-center"
      >
        <v-icon
          icon="mdi-key-chain-variant"
          size="44"
          color="accent"
        />
        <h2 class="text-h6 font-weight-bold mt-2">
          Contraseña temporal
        </h2>
        <p class="text-body-2 text-medium-emphasis">
          Entrégala a {{ shownPassword.user }}. No se volverá a mostrar y deberá cambiarla al ingresar.
        </p>
        <div class="temp">
          <code>{{ shownPassword.password }}</code>
          <v-btn
            icon="mdi-content-copy"
            variant="text"
            size="small"
            aria-label="Copiar contraseña"
            @click="copyPassword"
          />
        </div>
        <v-btn
          color="primary"
          variant="flat"
          block
          class="text-none mt-4"
          @click="shownPassword = null"
        >
          Listo
        </v-btn>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.toolbar__search {
  flex: 1 1 240px;
  max-width: 340px;
}

.toolbar__select {
  flex: 0 1 190px;
}

.panel {
  border-radius: 16px;
  border: 1px solid rgb(148 163 184 / 25%);
  background: rgb(30 41 59 / 92%);
  overflow: hidden;
}

.row--off {
  opacity: 0.55;
}

.temp {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 16px;
  padding: 12px;
  border-radius: 10px;
  border: 1px dashed rgb(6 182 212 / 60%);
  background: rgb(15 23 42 / 70%);
}

.temp code {
  font-size: 1.25rem;
  letter-spacing: 0.08em;
  color: var(--nt-text);
}
</style>
