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
  company: {
    // Tenant-scoped self administration of the user's OWN company (profile,
    // logo, readiness). Distinct from the platform-level `companies.*`.
    manage: 'company.manage',
  },
} as const;

export type PermissionName = {
  [Group in keyof typeof PERMISSIONS]: (typeof PERMISSIONS)[Group][keyof (typeof PERMISSIONS)[Group]];
}[keyof typeof PERMISSIONS];

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
