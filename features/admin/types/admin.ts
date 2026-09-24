/** Administración del personal interno. Contrato: InternalUsers/Roles/AuditController (policy AdminOnly). */

export interface InternalRoleInfo {
  id: number
  code: string
  name: string
}

export interface InternalUser {
  id: number
  firstName: string
  lastName: string
  fullName: string
  email: string
  role: InternalRoleInfo
  isActive: boolean
  mustChangePassword: boolean
  failedAttempts: number
  lockedUntilUtc: string | null
  isLocked: boolean
  lastAccessUtc: string | null
  createdAtUtc: string
  updatedAtUtc: string | null
  deactivatedAtUtc: string | null
}

export interface PagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export interface UserSearch {
  search?: string
  roleCode?: string
  isActive?: boolean
  isLocked?: boolean
  page: number
  pageSize: number
}

export interface CreateUserRequest {
  firstName: string
  lastName: string
  email: string
  roleCode: string
  temporaryPassword: string
}

export interface UpdateUserRequest {
  firstName: string
  lastName: string
  email: string
  roleCode: string
}

export interface AuditEntry {
  id: number
  actorType: string
  internalUserId: number | null
  internalUserName: string | null
  roleCode: string | null
  roleName: string | null
  buyerId: number | null
  action: string
  entity: string
  entityId: number | null
  entityDisplayName: string | null
  result: string
  ipAddress: string | null
  detail: string | null
  occurredAtUtc: string
}

export interface AuditSearch {
  action?: string
  result?: string
  page: number
  pageSize: number
}

export interface AdminService {
  roles: () => Promise<InternalRoleInfo[]>
  users: (q: UserSearch) => Promise<PagedResult<InternalUser>>
  create: (req: CreateUserRequest) => Promise<InternalUser>
  update: (id: number, req: UpdateUserRequest) => Promise<InternalUser>
  deactivate: (id: number) => Promise<InternalUser>
  activate: (id: number) => Promise<InternalUser>
  unlock: (id: number) => Promise<InternalUser>
  resetPassword: (id: number, temporaryPassword: string) => Promise<InternalUser>
  audit: (q: AuditSearch) => Promise<PagedResult<AuditEntry>>
}
