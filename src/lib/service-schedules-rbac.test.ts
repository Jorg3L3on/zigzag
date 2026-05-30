import { PERMISSIONS } from '@/lib/permissions';
import {
  SERVICE_SCHEDULES_READ_PERMISSION,
  SERVICE_SCHEDULES_WRITE_PERMISSIONS,
  canWriteServiceSchedules,
} from '@/lib/service-schedules-rbac';

describe('service schedules RBAC contract', () => {
  it('uses tickets.read as canonical read permission', () => {
    expect(SERVICE_SCHEDULES_READ_PERMISSION).toBe(PERMISSIONS.tickets.read);
  });

  it('allows write when user has tickets.write', () => {
    expect(
      canWriteServiceSchedules(
        (permission) => permission === PERMISSIONS.tickets.write,
      ),
    ).toBe(true);
  });

  it('allows write when user has clients.write', () => {
    expect(
      canWriteServiceSchedules(
        (permission) => permission === PERMISSIONS.clients.write,
      ),
    ).toBe(true);
  });

  it('denies write when user has neither write permission', () => {
    expect(canWriteServiceSchedules(() => false)).toBe(false);
  });

  it('keeps exactly the expected write permissions', () => {
    expect(SERVICE_SCHEDULES_WRITE_PERMISSIONS).toEqual([
      PERMISSIONS.tickets.write,
      PERMISSIONS.clients.write,
    ]);
  });
});
