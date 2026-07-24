import { PERMISSIONS, type PermissionName } from '@/lib/permissions';

/** Every canonical permission name from `PERMISSIONS`. */
export const ALL_PERMISSIONS = Object.values(PERMISSIONS).flatMap((group) =>
  Object.values(group),
) as PermissionName[];

export type RoleProfile = {
  label: string;
  permissions: PermissionName[];
  isSystem?: boolean;
};

/**
 * Seeded + edge role profiles. Seeded grants mirror `scripts/seed.ts`
 * (Admin / Operator / Viewer). Edge profiles encode documented policy from
 * `docs/rbac-policy.md`.
 */
export const ROLE_PROFILES: RoleProfile[] = [
  {
    label: 'Viewer',
    permissions: [
      PERMISSIONS.tickets.read,
      PERMISSIONS.services.read,
      PERMISSIONS.clients.read,
    ],
  },
  {
    label: 'Operator',
    permissions: [
      PERMISSIONS.tickets.read,
      PERMISSIONS.tickets.write,
      PERMISSIONS.services.read,
      PERMISSIONS.services.write,
      PERMISSIONS.clients.read,
      PERMISSIONS.clients.write,
      PERMISSIONS.users.read,
      PERMISSIONS.companies.read,
      PERMISSIONS.company.manage,
    ],
  },
  {
    label: 'Admin',
    permissions: ALL_PERMISSIONS,
  },
  {
    label: 'system-admin',
    isSystem: true,
    // Empty grant list on purpose: system bypass must not depend on assigned permissions.
    permissions: [],
  },
  {
    label: 'none',
    permissions: [],
  },
  {
    label: 'write-only-tickets',
    permissions: [PERMISSIONS.tickets.write],
  },
  {
    label: 'schedule-writer-via-clients',
    permissions: [PERMISSIONS.clients.read, PERMISSIONS.clients.write],
  },
];

/**
 * Documented role × permission expectation matrix.
 * Adding a permission to `PERMISSIONS` without updating every role row fails CI.
 */
export const ROLE_PERMISSION_MATRIX: Record<
  string,
  Record<PermissionName, boolean>
> = {
  Viewer: {
    [PERMISSIONS.tickets.read]: true,
    [PERMISSIONS.tickets.write]: false,
    [PERMISSIONS.services.read]: true,
    [PERMISSIONS.services.write]: false,
    [PERMISSIONS.clients.read]: true,
    [PERMISSIONS.clients.write]: false,
    [PERMISSIONS.users.read]: false,
    [PERMISSIONS.users.write]: false,
    [PERMISSIONS.roles.read]: false,
    [PERMISSIONS.roles.write]: false,
    [PERMISSIONS.permissions.read]: false,
    [PERMISSIONS.permissions.write]: false,
    [PERMISSIONS.companies.read]: false,
    [PERMISSIONS.companies.write]: false,
    [PERMISSIONS.company.manage]: false,
  },
  Operator: {
    [PERMISSIONS.tickets.read]: true,
    [PERMISSIONS.tickets.write]: true,
    [PERMISSIONS.services.read]: true,
    [PERMISSIONS.services.write]: true,
    [PERMISSIONS.clients.read]: true,
    [PERMISSIONS.clients.write]: true,
    [PERMISSIONS.users.read]: true,
    [PERMISSIONS.users.write]: false,
    [PERMISSIONS.roles.read]: false,
    [PERMISSIONS.roles.write]: false,
    [PERMISSIONS.permissions.read]: false,
    [PERMISSIONS.permissions.write]: false,
    [PERMISSIONS.companies.read]: true,
    [PERMISSIONS.companies.write]: false,
    [PERMISSIONS.company.manage]: true,
  },
  Admin: Object.fromEntries(
    ALL_PERMISSIONS.map((permission) => [permission, true]),
  ) as Record<PermissionName, boolean>,
  'system-admin': Object.fromEntries(
    ALL_PERMISSIONS.map((permission) => [permission, true]),
  ) as Record<PermissionName, boolean>,
  none: Object.fromEntries(
    ALL_PERMISSIONS.map((permission) => [permission, false]),
  ) as Record<PermissionName, boolean>,
  'write-only-tickets': {
    [PERMISSIONS.tickets.read]: false,
    [PERMISSIONS.tickets.write]: true,
    [PERMISSIONS.services.read]: false,
    [PERMISSIONS.services.write]: false,
    [PERMISSIONS.clients.read]: false,
    [PERMISSIONS.clients.write]: false,
    [PERMISSIONS.users.read]: false,
    [PERMISSIONS.users.write]: false,
    [PERMISSIONS.roles.read]: false,
    [PERMISSIONS.roles.write]: false,
    [PERMISSIONS.permissions.read]: false,
    [PERMISSIONS.permissions.write]: false,
    [PERMISSIONS.companies.read]: false,
    [PERMISSIONS.companies.write]: false,
    [PERMISSIONS.company.manage]: false,
  },
  'schedule-writer-via-clients': {
    [PERMISSIONS.tickets.read]: false,
    [PERMISSIONS.tickets.write]: false,
    [PERMISSIONS.services.read]: false,
    [PERMISSIONS.services.write]: false,
    [PERMISSIONS.clients.read]: true,
    [PERMISSIONS.clients.write]: true,
    [PERMISSIONS.users.read]: false,
    [PERMISSIONS.users.write]: false,
    [PERMISSIONS.roles.read]: false,
    [PERMISSIONS.roles.write]: false,
    [PERMISSIONS.permissions.read]: false,
    [PERMISSIONS.permissions.write]: false,
    [PERMISSIONS.companies.read]: false,
    [PERMISSIONS.companies.write]: false,
    [PERMISSIONS.company.manage]: false,
  },
};
