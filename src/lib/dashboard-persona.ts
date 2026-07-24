import { PERMISSIONS, type PermissionName } from '@/lib/permissions';

/**
 * Dashboard personas inferred from existing permissions only.
 * Do not key off role display names — tenants can rename roles.
 */
export type DashboardPersona = 'system' | 'admin' | 'operator' | 'viewer';

export type DashboardPersonaInput = {
  isSystem: boolean;
  /** True when a system user has no real tenant company selected. */
  needsCompanyContext: boolean;
  can: (permission?: PermissionName | string) => boolean;
};

/**
 * Resolve the dashboard persona from capability checks.
 * System users with a selected tenant company still get `admin` so they see
 * that tenant's operational dashboard with full platform capabilities.
 */
export const resolveDashboardPersona = (
  input: DashboardPersonaInput,
): DashboardPersona => {
  if (input.isSystem && input.needsCompanyContext) {
    return 'system';
  }

  if (input.isSystem) {
    return 'admin';
  }

  if (
    input.can(PERMISSIONS.users.write) ||
    input.can(PERMISSIONS.roles.write)
  ) {
    return 'admin';
  }

  if (input.can(PERMISSIONS.tickets.write)) {
    return 'operator';
  }

  return 'viewer';
};
