import {
  Role,
  PermissionEnum,
  RoleConfig,
  PermissionCategory,
} from '@/features/permission/types/permissionTypes'

export const rolesConfig: Record<Role, RoleConfig> = {
  [Role.ADMIN]: {
    role: Role.ADMIN,
    label: 'Administrator',
    description: 'Full access to all system features',
    level: 100,
    defaultPermissions: [...Object.values(PermissionEnum)],
  },
  [Role.MANAGER]: {
    role: Role.MANAGER,
    label: 'Manager',
    description: 'Process and team management',
    level: 50,
    defaultPermissions: [
      PermissionEnum.PROCESS_VIEW,
      PermissionEnum.PROCESS_CREATE,
      PermissionEnum.PROCESS_EDIT,
      PermissionEnum.PROCESS_APPROVE,
      PermissionEnum.PROCESS_EXECUTE,

      PermissionEnum.DOCUMENT_VIEW,
      PermissionEnum.DOCUMENT_CREATE,
      PermissionEnum.DOCUMENT_EDIT,
      PermissionEnum.DOCUMENT_SIGN,
      PermissionEnum.DOCUMENT_EXPORT,

      PermissionEnum.USER_VIEW,

      PermissionEnum.TASK_VIEW,
      PermissionEnum.TASK_CREATE,
      PermissionEnum.TASK_EDIT,
      PermissionEnum.TASK_ASSIGN,
      PermissionEnum.TASK_COMPLETE,

      PermissionEnum.REPORT_VIEW,
      PermissionEnum.REPORT_CREATE,
      PermissionEnum.REPORT_EXPORT,

      PermissionEnum.SETTINGS_VIEW,
    ],
  },
  [Role.USER]: {
    role: Role.USER,
    label: 'User',
    description: 'Basic system access',
    level: 10,
    defaultPermissions: [
      PermissionEnum.PROCESS_VIEW,
      PermissionEnum.PROCESS_EXECUTE,

      PermissionEnum.DOCUMENT_VIEW,
      PermissionEnum.DOCUMENT_CREATE,

      PermissionEnum.TASK_VIEW,
      PermissionEnum.TASK_CREATE,
      PermissionEnum.TASK_EDIT,
      PermissionEnum.TASK_COMPLETE,

      PermissionEnum.REPORT_VIEW,
    ],
  },
}

export const permissionCategories: PermissionCategory[] = [
  {
    id: 'processes',
    label: 'Processes',
    permissions: [
      PermissionEnum.PROCESS_VIEW,
      PermissionEnum.PROCESS_CREATE,
      PermissionEnum.PROCESS_EDIT,
      PermissionEnum.PROCESS_DELETE,
      PermissionEnum.PROCESS_APPROVE,
      PermissionEnum.PROCESS_EXECUTE,
    ],
  },
  {
    id: 'documents',
    label: 'Documents',
    permissions: [
      PermissionEnum.DOCUMENT_VIEW,
      PermissionEnum.DOCUMENT_CREATE,
      PermissionEnum.DOCUMENT_EDIT,
      PermissionEnum.DOCUMENT_DELETE,
      PermissionEnum.DOCUMENT_SIGN,
      PermissionEnum.DOCUMENT_EXPORT,
    ],
  },
  {
    id: 'users',
    label: 'Users',
    permissions: [
      PermissionEnum.USER_VIEW,
      PermissionEnum.USER_CREATE,
      PermissionEnum.USER_EDIT,
      PermissionEnum.USER_DELETE,
      PermissionEnum.USER_MANAGE_ROLES,
      PermissionEnum.USER_MANAGE_PERMISSIONS,
    ],
  },
  {
    id: 'tasks',
    label: 'Tasks',
    permissions: [
      PermissionEnum.TASK_VIEW,
      PermissionEnum.TASK_CREATE,
      PermissionEnum.TASK_EDIT,
      PermissionEnum.TASK_DELETE,
      PermissionEnum.TASK_ASSIGN,
      PermissionEnum.TASK_COMPLETE,
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    permissions: [
      PermissionEnum.REPORT_VIEW,
      PermissionEnum.REPORT_CREATE,
      PermissionEnum.REPORT_EXPORT,
    ],
  },
  {
    id: 'system',
    label: 'System',
    permissions: [
      PermissionEnum.SETTINGS_VIEW,
      PermissionEnum.SETTINGS_EDIT,
      PermissionEnum.SYSTEM_ADMIN,
      PermissionEnum.SYSTEM_LOGS_VIEW,
      PermissionEnum.SYSTEM_BACKUP,
      PermissionEnum.SYSTEM_INTEGRATIONS,
    ],
  },
]

export const permissionDescriptions: Record<PermissionEnum, string> = {
  [PermissionEnum.PROCESS_VIEW]: 'View processes',
  [PermissionEnum.PROCESS_CREATE]: 'Create processes',
  [PermissionEnum.PROCESS_EDIT]: 'Edit processes',
  [PermissionEnum.PROCESS_DELETE]: 'Delete processes',
  [PermissionEnum.PROCESS_APPROVE]: 'Approve processes',
  [PermissionEnum.PROCESS_EXECUTE]: 'Execute processes',

  [PermissionEnum.DOCUMENT_VIEW]: 'View documents',
  [PermissionEnum.DOCUMENT_CREATE]: 'Create documents',
  [PermissionEnum.DOCUMENT_EDIT]: 'Edit documents',
  [PermissionEnum.DOCUMENT_DELETE]: 'Delete documents',
  [PermissionEnum.DOCUMENT_SIGN]: 'Sign documents',
  [PermissionEnum.DOCUMENT_EXPORT]: 'Export documents',

  [PermissionEnum.USER_VIEW]: 'View users',
  [PermissionEnum.USER_CREATE]: 'Create users',
  [PermissionEnum.USER_EDIT]: 'Edit users',
  [PermissionEnum.USER_DELETE]: 'Delete users',
  [PermissionEnum.USER_MANAGE_ROLES]: 'Manage roles',
  [PermissionEnum.USER_MANAGE_PERMISSIONS]: 'Manage permissions',

  [PermissionEnum.TASK_VIEW]: 'View tasks',
  [PermissionEnum.TASK_CREATE]: 'Create tasks',
  [PermissionEnum.TASK_EDIT]: 'Edit tasks',
  [PermissionEnum.TASK_DELETE]: 'Delete tasks',
  [PermissionEnum.TASK_ASSIGN]: 'Assign tasks',
  [PermissionEnum.TASK_COMPLETE]: 'Complete tasks',

  [PermissionEnum.REPORT_VIEW]: 'View reports',
  [PermissionEnum.REPORT_CREATE]: 'Create reports',
  [PermissionEnum.REPORT_EXPORT]: 'Export reports',

  [PermissionEnum.SETTINGS_VIEW]: 'View settings',
  [PermissionEnum.SETTINGS_EDIT]: 'Edit settings',

  [PermissionEnum.SYSTEM_ADMIN]: 'System administration',
  [PermissionEnum.SYSTEM_LOGS_VIEW]: 'View logs',
  [PermissionEnum.SYSTEM_BACKUP]: 'Backup',
  [PermissionEnum.SYSTEM_INTEGRATIONS]: 'Manage integrations',
}
