export const PERMISSIONS = {
  tickets: {
    read: 'tickets.read',
    write: 'tickets.write',
  },
  services: {
    read: 'services.read',
    write: 'services.write',
  },
  clients: {
    read: 'clients.read',
    write: 'clients.write',
  },
  users: {
    read: 'users.read',
    write: 'users.write',
  },
  roles: {
    read: 'roles.read',
    write: 'roles.write',
  },
  permissions: {
    read: 'permissions.read',
    write: 'permissions.write',
  },
  companies: {
    read: 'companies.read',
    write: 'companies.write',
  },
} as const;

export type PermissionName =
  (typeof PERMISSIONS)[keyof typeof PERMISSIONS][keyof (typeof PERMISSIONS)[keyof typeof PERMISSIONS]];

export type PermissionMap = {
  isSystem: boolean;
  permissions: string[];
};

export function canAccessPermission(
  map: PermissionMap,
  permission?: PermissionName | string,
): boolean {
  return map.isSystem || !permission || map.permissions.includes(permission);
}
