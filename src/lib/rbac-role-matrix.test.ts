import { PERMISSIONS } from '@/lib/permissions';
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
  canReadTickets,
  canWriteTickets,
} from '@/lib/tickets-rbac';
import {
  canReadServiceSchedules,
  canWriteServiceSchedules,
} from '@/lib/service-schedules-rbac';

type RoleProfile = {
  label: string;
  permissions: string[];
  isSystem?: boolean;
};

const profiles: RoleProfile[] = [
  {
    label: 'viewer',
    permissions: [
      PERMISSIONS.tickets.read,
      PERMISSIONS.clients.read,
      PERMISSIONS.services.read,
    ],
  },
  {
    label: 'operator',
    permissions: [
      PERMISSIONS.tickets.read,
      PERMISSIONS.tickets.write,
      PERMISSIONS.clients.read,
      PERMISSIONS.clients.write,
      PERMISSIONS.services.read,
      PERMISSIONS.services.write,
    ],
  },
  {
    label: 'write-only-tickets',
    permissions: [PERMISSIONS.tickets.write],
  },
  {
    label: 'schedule-writer-via-clients',
    permissions: [PERMISSIONS.clients.read, PERMISSIONS.clients.write],
  },
  {
    label: 'system-admin',
    isSystem: true,
    permissions: Object.values(PERMISSIONS).flatMap((group) =>
      Object.values(group),
    ),
  },
];

const canFor =
  (permissions: string[], isSystem = false) =>
  (permission?: string) =>
    isSystem || !permission || permissions.includes(permission);

describe('RBAC role matrix', () => {
  it.each(profiles)('$label read/write expectations', ({ permissions, isSystem, label }) => {
    const can = canFor(permissions, isSystem);

    if (label === 'viewer') {
      expect(canReadTickets(can)).toBe(true);
      expect(canWriteTickets(can)).toBe(false);
      expect(canReadClients(can)).toBe(true);
      expect(canWriteClients(can)).toBe(false);
      expect(canReadServices(can)).toBe(true);
      expect(canWriteServices(can)).toBe(false);
      expect(canReadServiceSchedules(can)).toBe(true);
      expect(canWriteServiceSchedules(can)).toBe(false);
    }

    if (label === 'operator') {
      expect(canWriteTickets(can)).toBe(true);
      expect(canWriteClients(can)).toBe(true);
      expect(canWriteServices(can)).toBe(true);
      expect(canWriteServiceSchedules(can)).toBe(true);
    }

    if (label === 'write-only-tickets') {
      expect(canReadTickets(can)).toBe(false);
      expect(canWriteTickets(can)).toBe(true);
    }

    if (label === 'schedule-writer-via-clients') {
      expect(canReadServiceSchedules(can)).toBe(false);
      expect(canWriteServiceSchedules(can)).toBe(true);
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
});
