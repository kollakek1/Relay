export enum Role {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  USER = 'USER',
}

export enum PermissionEnum {
  PROCESS_VIEW = 'process.view',
  PROCESS_CREATE = 'process.create',
  PROCESS_EDIT = 'process.edit',
  PROCESS_DELETE = 'process.delete',
  PROCESS_APPROVE = 'process.approve',
  PROCESS_EXECUTE = 'process.execute',

  DOCUMENT_VIEW = 'document.view',
  DOCUMENT_CREATE = 'document.create',
  DOCUMENT_EDIT = 'document.edit',
  DOCUMENT_DELETE = 'document.delete',
  DOCUMENT_SIGN = 'document.sign',
  DOCUMENT_EXPORT = 'document.export',

  USER_VIEW = 'user.view',
  USER_CREATE = 'user.create',
  USER_EDIT = 'user.edit',
  USER_DELETE = 'user.delete',
  USER_MANAGE_ROLES = 'user.manage_roles',
  USER_MANAGE_PERMISSIONS = 'user.manage_permissions',

  TASK_VIEW = 'task.view',
  TASK_CREATE = 'task.create',
  TASK_EDIT = 'task.edit',
  TASK_DELETE = 'task.delete',
  TASK_ASSIGN = 'task.assign',
  TASK_COMPLETE = 'task.complete',

  REPORT_VIEW = 'report.view',
  REPORT_CREATE = 'report.create',
  REPORT_EXPORT = 'report.export',

  SETTINGS_VIEW = 'settings.view',
  SETTINGS_EDIT = 'settings.edit',

  SYSTEM_ADMIN = 'system.admin',
  SYSTEM_LOGS_VIEW = 'system.logs_view',
  SYSTEM_BACKUP = 'system.backup',
  SYSTEM_INTEGRATIONS = 'system.integrations',
}

export interface Permission {
  id: string
  name: string
  description?: string
  category?: string
}

export interface UserWithPermissions {
  id: string
  name: string
  email: string
  role: Role
  permissions: Permission[]
}

export interface RoleConfig {
  role: Role
  label: string
  description: string
  defaultPermissions: PermissionEnum[]
  level: number
}

export interface PermissionCategory {
  id: string
  label: string
  permissions: PermissionEnum[]
}
