import { canAccessPermission, PERMISSIONS } from '@/lib/permissions';
import {
  ALL_PERMISSIONS,
  ROLE_PERMISSION_MATRIX,
  ROLE_PROFILES,
} from '@/lib/rbac-role-matrix';
import {
  canReadClients,
  canWriteClients,
  CLIENTS_READ_PERMISSION,
  CLIENTS_WRITE_PERMISSION,
} from '@/lib/clients-rbac';
import {
  canReadServices,
  canWriteServices,
  SERVICES_READ_PERMISSION,
  SERVICES_WRITE_PERMISSION,
} from '@/lib/services-rbac';
import {
  canManageCompanies,
  canReadCompanies,
  canWriteCompanies,
} from '@/lib/companies-rbac';
import {
  canManageUsers,
  canReadUsers,
  canWriteUsers,
} from '@/lib/users-rbac';
import {
  canManageRoles,
  canReadRoles,
  canWriteRoles,
} from '@/lib/roles-rbac';
import {
  canManagePermissions,
  canReadPermissions,
  canWritePermissions,
} from '@/lib/permissions-rbac';
import {
  canAssignTicketServices,
  canCollectTicketPayment,
  canDownloadTicketInvoice,
  canEditTicket,
  canFinishTicket,
  canReadTickets,
  canWriteTickets,
} from '@/lib/tickets-rbac';
import {
  canCreateTicketFromSchedule,
  canReadServiceSchedules,
  canWriteServiceSchedules,
} from '@/lib/service-schedules-rbac';

const canFor =
  (permissions: string[], isSystem = false) =>
  (permission?: string) =>
    canAccessPermission({ isSystem, permissions }, permission);

describe('RBAC role matrix', () => {
  it('documents every canonical permission in ROLE_PERMISSION_MATRIX for every role', () => {
    const sortedPermissions = [...ALL_PERMISSIONS].sort();

    expect(Object.keys(ROLE_PERMISSION_MATRIX).sort()).toEqual(
      [...ROLE_PROFILES.map((profile) => profile.label)].sort(),
    );

    for (const [roleLabel, expectations] of Object.entries(
      ROLE_PERMISSION_MATRIX,
    )) {
      expect({
        role: roleLabel,
        permissions: Object.keys(expectations).sort(),
      }).toEqual({
        role: roleLabel,
        permissions: sortedPermissions,
      });
    }
  });

  it.each(ROLE_PROFILES)(
    '$label × every permission matches documented matrix',
    ({ label, permissions, isSystem }) => {
      const expected = ROLE_PERMISSION_MATRIX[label];
      expect(expected).toBeDefined();

      for (const permission of ALL_PERMISSIONS) {
        expect({
          role: label,
          permission,
          allowed: canAccessPermission(
            { isSystem: Boolean(isSystem), permissions },
            permission,
          ),
        }).toEqual({
          role: label,
          permission,
          allowed: expected[permission],
        });
      }
    },
  );

  it.each(ALL_PERMISSIONS)(
    '%s has an explicit allow and deny outcome',
    (permission) => {
      expect(
        canAccessPermission(
          { isSystem: false, permissions: [permission] },
          permission,
        ),
      ).toBe(true);
      expect(
        canAccessPermission({ isSystem: false, permissions: [] }, permission),
      ).toBe(false);
    },
  );

  it('system-admin bypasses every permission without grants; regular user does not', () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(
        canAccessPermission({ isSystem: true, permissions: [] }, permission),
      ).toBe(true);
      expect(
        canAccessPermission({ isSystem: false, permissions: [] }, permission),
      ).toBe(false);
    }
  });

  it.each(ROLE_PROFILES)('$label resource capability expectations', ({
    permissions,
    isSystem,
    label,
  }) => {
    const can = canFor(permissions, isSystem);

    if (label === 'Viewer') {
      expect(canReadTickets(can)).toBe(true);
      expect(canWriteTickets(can)).toBe(false);
      expect(canEditTicket(can)).toBe(false);
      expect(canFinishTicket(can)).toBe(false);
      expect(canCollectTicketPayment(can)).toBe(false);
      expect(canAssignTicketServices(can)).toBe(false);
      expect(canDownloadTicketInvoice(can)).toBe(true);
      expect(canReadClients(can)).toBe(true);
      expect(canWriteClients(can)).toBe(false);
      expect(canReadServices(can)).toBe(true);
      expect(canWriteServices(can)).toBe(false);
      expect(canReadServiceSchedules(can)).toBe(true);
      expect(canWriteServiceSchedules(can)).toBe(false);
      expect(canCreateTicketFromSchedule(can)).toBe(false);
      expect(canReadUsers(can)).toBe(false);
      expect(canWriteUsers(can)).toBe(false);
      expect(canReadRoles(can)).toBe(false);
      expect(canWriteRoles(can)).toBe(false);
      expect(canReadPermissions(can)).toBe(false);
      expect(canWritePermissions(can)).toBe(false);
      expect(canReadCompanies(can)).toBe(false);
      expect(canWriteCompanies(can)).toBe(false);
      expect(canManageUsers(false, can)).toBe(false);
      expect(canManageRoles(false, can)).toBe(false);
      expect(canManagePermissions(false, can)).toBe(false);
      expect(canManageCompanies(false, can)).toBe(false);
    }

    if (label === 'Operator') {
      expect(canWriteTickets(can)).toBe(true);
      expect(canWriteClients(can)).toBe(true);
      expect(canWriteServices(can)).toBe(true);
      expect(canWriteServiceSchedules(can)).toBe(true);
      expect(canCreateTicketFromSchedule(can)).toBe(true);
      expect(canReadUsers(can)).toBe(true);
      expect(canWriteUsers(can)).toBe(false);
      expect(canReadCompanies(can)).toBe(true);
      expect(canWriteCompanies(can)).toBe(false);
      expect(canManageUsers(false, can)).toBe(false);
      expect(canManageCompanies(false, can)).toBe(false);
      expect(can(PERMISSIONS.company.manage)).toBe(true);
    }

    if (label === 'Admin') {
      for (const permission of ALL_PERMISSIONS) {
        expect(can(permission)).toBe(true);
      }
      // Tenant Admin still cannot manage platform resources without system flag.
      expect(canManageUsers(false, can)).toBe(false);
      expect(canManageRoles(false, can)).toBe(false);
      expect(canManagePermissions(false, can)).toBe(false);
      expect(canManageCompanies(false, can)).toBe(false);
    }

    if (label === 'write-only-tickets') {
      expect(canReadTickets(can)).toBe(false);
      expect(canWriteTickets(can)).toBe(true);
      expect(canEditTicket(can)).toBe(true);
      expect(canFinishTicket(can)).toBe(true);
      expect(canCollectTicketPayment(can)).toBe(true);
      expect(canAssignTicketServices(can)).toBe(true);
      expect(canDownloadTicketInvoice(can)).toBe(false);
      expect(canReadServiceSchedules(can)).toBe(false);
      expect(canWriteServiceSchedules(can)).toBe(true);
      expect(canCreateTicketFromSchedule(can)).toBe(true);
    }

    if (label === 'schedule-writer-via-clients') {
      expect(canReadServiceSchedules(can)).toBe(false);
      expect(canWriteServiceSchedules(can)).toBe(true);
      expect(canCreateTicketFromSchedule(can)).toBe(false);
    }

    if (label === 'system-admin') {
      expect(canManageUsers(true, can)).toBe(true);
      expect(canManageRoles(true, can)).toBe(true);
      expect(canManagePermissions(true, can)).toBe(true);
      expect(canManageCompanies(true, can)).toBe(true);
      expect(canReadCompanies(can)).toBe(true);
      expect(canWriteCompanies(can)).toBe(true);
      expect(canReadUsers(can)).toBe(true);
      expect(canWriteUsers(can)).toBe(true);
      expect(canReadRoles(can)).toBe(true);
      expect(canWriteRoles(can)).toBe(true);
      expect(canReadPermissions(can)).toBe(true);
      expect(canWritePermissions(can)).toBe(true);
      expect(canReadTickets(can)).toBe(true);
      expect(canWriteTickets(can)).toBe(true);
      expect(canReadClients(can)).toBe(true);
      expect(canWriteClients(can)).toBe(true);
      expect(canReadServices(can)).toBe(true);
      expect(canWriteServices(can)).toBe(true);
      expect(canReadServiceSchedules(can)).toBe(true);
      expect(canWriteServiceSchedules(can)).toBe(true);
    }

    if (label === 'none') {
      expect(canReadTickets(can)).toBe(false);
      expect(canWriteTickets(can)).toBe(false);
      expect(canReadClients(can)).toBe(false);
      expect(canWriteClients(can)).toBe(false);
      expect(canReadServices(can)).toBe(false);
      expect(canWriteServices(can)).toBe(false);
      expect(canReadServiceSchedules(can)).toBe(false);
      expect(canWriteServiceSchedules(can)).toBe(false);
    }
  });

  it('documents permission constants for major resources', () => {
    expect(CLIENTS_READ_PERMISSION).toBe(PERMISSIONS.clients.read);
    expect(CLIENTS_WRITE_PERMISSION).toBe(PERMISSIONS.clients.write);
    expect(SERVICES_READ_PERMISSION).toBe(PERMISSIONS.services.read);
    expect(SERVICES_WRITE_PERMISSION).toBe(PERMISSIONS.services.write);
  });

  it('blocks admin management for non-system users even with write permission', () => {
    const can = canFor([
      PERMISSIONS.users.write,
      PERMISSIONS.roles.write,
      PERMISSIONS.permissions.write,
      PERMISSIONS.companies.write,
    ]);

    expect(canManageUsers(false, can)).toBe(false);
    expect(canManageRoles(false, can)).toBe(false);
    expect(canManagePermissions(false, can)).toBe(false);
    expect(canManageCompanies(false, can)).toBe(false);
  });

  it('allows admin management only when system flag and write permission combine', () => {
    const withWrite = canFor([
      PERMISSIONS.users.write,
      PERMISSIONS.roles.write,
      PERMISSIONS.permissions.write,
      PERMISSIONS.companies.write,
    ]);
    const withoutWrite = canFor([]);

    expect(canManageUsers(true, withWrite)).toBe(true);
    expect(canManageRoles(true, withWrite)).toBe(true);
    expect(canManagePermissions(true, withWrite)).toBe(true);
    expect(canManageCompanies(true, withWrite)).toBe(true);

    expect(canManageUsers(true, withoutWrite)).toBe(false);
    expect(canManageRoles(true, withoutWrite)).toBe(false);
    expect(canManagePermissions(true, withoutWrite)).toBe(false);
    expect(canManageCompanies(true, withoutWrite)).toBe(false);
  });
});
