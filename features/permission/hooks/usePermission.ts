'use client'

import { useCallback, useMemo } from 'react'
import { useUserStore } from '@/features/user/stores/useUserStore'
import { Role, PermissionEnum } from '@/features/permission/types/permissionTypes'
import { rolesConfig } from '@/features/permission/configs/permissionConfig'

interface UsePermissionsReturn {
  role: Role | null
  permissions: string[]
  isAdmin: boolean
  isManager: boolean
  isUser: boolean

  hasRole: (role: Role | Role[]) => boolean
  hasPermission: (permission: PermissionEnum | PermissionEnum[]) => boolean
  hasAllPermissions: (...permissions: PermissionEnum[]) => boolean
  hasAnyPermission: (...permissions: PermissionEnum[]) => boolean
  canAccess: (requiredRole?: Role, requiredPermissions?: PermissionEnum[]) => boolean

  getRoleLabel: () => string
  getRoleLevel: () => number
  isHigherOrEqualRole: (role: Role) => boolean
}

export function usePermissions(): UsePermissionsReturn {
  const { user } = useUserStore()

  const role = user?.role || null

  const permissions = useMemo(() => {
    if (!user) return []

    const rolePermissions = role ? rolesConfig[role as Role]?.defaultPermissions || [] : []
    const customPermissions = user.permissions?.map((p: { name: string }) => p.name) || []

    return [...new Set([...rolePermissions, ...customPermissions])]
  }, [user, role])

  const isAdmin = role === Role.ADMIN
  const isManager = role === Role.MANAGER
  const isUser = role === Role.USER

  const hasRole = useCallback(
    (checkRole: Role | Role[]): boolean => {
      if (!role) return false

      if (Array.isArray(checkRole)) {
        return checkRole.includes(role)
      }

      return role === checkRole
    },
    [role]
  )

  const hasPermission = useCallback(
    (permission: PermissionEnum | PermissionEnum[]): boolean => {
      if (isAdmin) return true

      if (Array.isArray(permission)) {
        return permission.some((p) => permissions.includes(p))
      }

      return permissions.includes(permission)
    },
    [permissions, isAdmin]
  )

  const hasAllPermissions = useCallback(
    (...requiredPermissions: PermissionEnum[]): boolean => {
      if (isAdmin) return true

      return requiredPermissions.every((p) => permissions.includes(p))
    },
    [permissions, isAdmin]
  )

  const hasAnyPermission = useCallback(
    (...requiredPermissions: PermissionEnum[]): boolean => {
      if (isAdmin) return true

      return requiredPermissions.some((p) => permissions.includes(p))
    },
    [permissions, isAdmin]
  )

  const canAccess = useCallback(
    (requiredRole?: Role, requiredPermissions?: PermissionEnum[]): boolean => {
      if (!user || !role) return false

      if (isAdmin) return true

      if (requiredRole && !hasRole(requiredRole)) {
        return false
      }

      if (requiredPermissions && requiredPermissions.length > 0) {
        return hasAllPermissions(...requiredPermissions)
      }

      return true
    },
    [user, role, isAdmin, hasRole, hasAllPermissions]
  )

  const getRoleLabel = useCallback((): string => {
    if (!role) return 'Guest'
    return rolesConfig[role as Role]?.label || 'Unknown role'
  }, [role])

  const getRoleLevel = useCallback((): number => {
    if (!role) return 0
    return rolesConfig[role as Role]?.level || 0
  }, [role])

  const isHigherOrEqualRole = useCallback(
    (compareRole: Role): boolean => {
      if (!role) return false

      const currentLevel = getRoleLevel()
      const compareLevel = rolesConfig[compareRole]?.level || 0

      return currentLevel >= compareLevel
    },
    [role, getRoleLevel]
  )

  return {
    role,
    permissions,
    isAdmin,
    isManager,
    isUser,

    hasRole,
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    canAccess,

    getRoleLabel,
    getRoleLevel,
    isHigherOrEqualRole,
  }
}
