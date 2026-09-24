import type { AdminService, AuditEntry, InternalRoleInfo, InternalUser, PagedResult } from '../types/admin'
import { useApi } from '~/services/api'
import type { ApiError, HttpClient } from '~/types/api'

const ROLES: InternalRoleInfo[] = [
  { id: 1, code: 'ADMIN', name: 'Administrador' },
  { id: 2, code: 'SUPERVISOR', name: 'Supervisor' },
  { id: 3, code: 'REPARTIDOR', name: 'Repartidor' }
]

function mockUser(id: number, firstName: string, lastName: string, email: string, roleCode: string, extra: Partial<InternalUser> = {}): InternalUser {
  return {
    id,
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    email,
    role: ROLES.find(r => r.code === roleCode)!,
    isActive: true,
    mustChangePassword: false,
    failedAttempts: 0,
    lockedUntilUtc: null,
    isLocked: false,
    lastAccessUtc: new Date(Date.now() - id * 3_600_000).toISOString(),
    createdAtUtc: '2026-09-01T15:00:00Z',
    updatedAtUtc: null,
    deactivatedAtUtc: null,
    ...extra
  }
}

/** Copia simple (los datos del mock son proxies reactivos y structuredClone no los acepta). */
function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function page<T>(all: T[], p: number, size: number): PagedResult<T> {
  const start = (p - 1) * size
  return { items: all.slice(start, start + size), page: p, pageSize: size, totalItems: all.length, totalPages: Math.max(1, Math.ceil(all.length / size)) }
}

/** Datos de demostración en memoria (se reinician al recargar). */
export function createMockAdminService(): AdminService {
  const users = useState<InternalUser[]>('nt-mock-internal-users', () => [
    mockUser(1, 'Admin', 'NextTech', 'admin@nexttech.com', 'ADMIN'),
    mockUser(2, 'Supervisor', 'Prueba', 'supervisor@nexttech.com', 'SUPERVISOR'),
    mockUser(3, 'Repartidor', 'Prueba', 'repartidor@nexttech.com', 'REPARTIDOR'),
    mockUser(4, 'Luis', 'García', 'luis.garcia@nexttech.com', 'REPARTIDOR', { isLocked: true, failedAttempts: 5, lockedUntilUtc: new Date(Date.now() + 900_000).toISOString() }),
    mockUser(5, 'Ana', 'Pérez', 'ana.perez@nexttech.com', 'SUPERVISOR', { mustChangePassword: true, lastAccessUtc: null }),
    mockUser(6, 'Carlos', 'López', 'carlos.lopez@nexttech.com', 'REPARTIDOR', { isActive: false, deactivatedAtUtc: '2026-09-15T10:00:00Z' })
  ])
  const audit = useState<AuditEntry[]>('nt-mock-audit', () => {
    const base = Date.now()
    const rows: [string, string, string, string][] = [
      ['LOGIN', 'UsuarioInterno', 'EXITOSO', 'Supervisor Prueba'],
      ['LOGIN_FALLIDO', 'UsuarioInterno', 'FALLIDO', 'Luis García'],
      ['USER_CREATED', 'UsuarioInterno', 'EXITOSO', 'Ana Pérez'],
      ['USER_DEACTIVATED', 'UsuarioInterno', 'EXITOSO', 'Carlos López'],
      ['PASSWORD_CHANGED', 'UsuarioInterno', 'EXITOSO', 'Repartidor Prueba']
    ]
    return rows.map(([action, entity, result, name], i) => ({
      id: 100 - i, actorType: 'internal', internalUserId: 1, internalUserName: 'Admin NextTech', roleCode: 'ADMIN', roleName: 'Administrador',
      buyerId: null, action, entity, entityId: i + 2, entityDisplayName: name, result, ipAddress: '10.0.0.12', detail: null,
      occurredAtUtc: new Date(base - i * 5_400_000).toISOString()
    }))
  })

  const wait = () => new Promise(r => setTimeout(r, 250))
  const find = (id: number): InternalUser => {
    const u = users.value.find(x => x.id === id)
    if (!u) throw { status: 404, code: 'NOT_FOUND', message: 'El usuario no existe.' } satisfies ApiError
    return u
  }
  const log = (action: string, u: InternalUser) => audit.value.unshift({
    id: Date.now(), actorType: 'internal', internalUserId: 1, internalUserName: 'Admin NextTech', roleCode: 'ADMIN', roleName: 'Administrador',
    buyerId: null, action, entity: 'UsuarioInterno', entityId: u.id, entityDisplayName: u.fullName, result: 'EXITOSO', ipAddress: '10.0.0.12', detail: null,
    occurredAtUtc: new Date().toISOString()
  })
  const touch = (u: InternalUser, action: string): InternalUser => {
    u.updatedAtUtc = new Date().toISOString()
    log(action, u)
    return copy(u)
  }

  return {
    async roles() {
      return ROLES
    },
    async users(q) {
      await wait()
      const s = q.search?.trim().toLowerCase()
      const list = users.value.filter(u =>
        (!s || `${u.fullName} ${u.email}`.toLowerCase().includes(s))
        && (!q.roleCode || u.role.code === q.roleCode)
        && (q.isActive === undefined || u.isActive === q.isActive)
        && (q.isLocked === undefined || u.isLocked === q.isLocked)
      )
      return copy(page(list, q.page, q.pageSize))
    },
    async create(req) {
      await wait()
      if (users.value.some(u => u.email.toLowerCase() === req.email.trim().toLowerCase())) {
        throw { status: 409, code: 'CONFLICT', message: 'Ya existe un usuario con ese correo.' } satisfies ApiError
      }
      const u = mockUser(Math.max(...users.value.map(x => x.id)) + 1, req.firstName.trim(), req.lastName.trim(), req.email.trim(), req.roleCode, { mustChangePassword: true, lastAccessUtc: null, createdAtUtc: new Date().toISOString() })
      users.value.push(u)
      return touch(u, 'USER_CREATED')
    },
    async update(id, req) {
      await wait()
      const u = find(id)
      Object.assign(u, { firstName: req.firstName.trim(), lastName: req.lastName.trim(), fullName: `${req.firstName.trim()} ${req.lastName.trim()}`, email: req.email.trim(), role: ROLES.find(r => r.code === req.roleCode)! })
      return touch(u, 'USER_UPDATED')
    },
    async deactivate(id) {
      await wait()
      const u = find(id)
      Object.assign(u, { isActive: false, deactivatedAtUtc: new Date().toISOString() })
      return touch(u, 'USER_DEACTIVATED')
    },
    async activate(id) {
      await wait()
      const u = find(id)
      Object.assign(u, { isActive: true, deactivatedAtUtc: null })
      return touch(u, 'USER_ACTIVATED')
    },
    async unlock(id) {
      await wait()
      const u = find(id)
      Object.assign(u, { isLocked: false, failedAttempts: 0, lockedUntilUtc: null })
      return touch(u, 'USER_UNLOCKED')
    },
    async resetPassword(id) {
      await wait()
      const u = find(id)
      u.mustChangePassword = true
      return touch(u, 'PASSWORD_RESET')
    },
    async audit(q) {
      await wait()
      const list = audit.value.filter(a => (!q.action || a.action === q.action) && (!q.result || a.result === q.result))
      return copy(page(list, q.page, q.pageSize))
    }
  }
}

function clean(query: Record<string, unknown>): Record<string, string | number | boolean> {
  return Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')) as Record<string, string | number | boolean>
}

export function createHttpAdminService(api: HttpClient): AdminService {
  const base = '/api/internal/users'
  return {
    roles: () => api('/api/internal/roles'),
    users: q => api(base, { query: clean({ ...q }) }),
    create: req => api(base, { method: 'POST', body: { ...req } }),
    update: (id, req) => api(`${base}/${id}`, { method: 'PUT', body: { ...req } }),
    deactivate: id => api(`${base}/${id}`, { method: 'DELETE' }),
    activate: id => api(`${base}/${id}/activate`, { method: 'POST' }),
    unlock: id => api(`${base}/${id}/unlock`, { method: 'POST' }),
    resetPassword: (id, temporaryPassword) => api(`${base}/${id}/reset-password`, { method: 'POST', body: { temporaryPassword } }),
    audit: q => api('/api/internal/audit', { query: clean({ ...q }) })
  }
}

export function useAdminService(): AdminService {
  return useRuntimeConfig().public.useMocks ? createMockAdminService() : createHttpAdminService(useApi())
}

/** Contraseña temporal que cumple la política (8+ con mayúscula, minúscula y número). */
export function generateTemporaryPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnpqrstuvwxyz'
  const digits = '23456789'
  const all = upper + lower + digits
  const bytes = new Uint32Array(12)
  crypto.getRandomValues(bytes)
  const pick = (set: string, n: number) => set[n % set.length]!
  const chars = [pick(upper, bytes[0]!), pick(lower, bytes[1]!), pick(digits, bytes[2]!), ...Array.from(bytes.slice(3), b => pick(all, b))]
  return chars.sort(() => (crypto.getRandomValues(new Uint8Array(1))[0]! % 2) - 0.5).join('')
}
