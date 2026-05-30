import { AuthorizationError } from '@/lib/errors';
import { requireActionPermission } from '@/lib/security';
import {
  SERVICE_SCHEDULES_READ_PERMISSION,
  SERVICE_SCHEDULES_WRITE_PERMISSIONS,
} from '@/lib/service-schedules-rbac';

export const requireScheduleRead = async (companyId?: number | null) =>
  requireActionPermission(
    SERVICE_SCHEDULES_READ_PERMISSION,
    companyId ?? undefined,
  );

export const requireScheduleWrite = async (companyId?: number | null) => {
  const [primaryWritePermission, fallbackWritePermission] =
    SERVICE_SCHEDULES_WRITE_PERMISSIONS;

  try {
    return await requireActionPermission(
      primaryWritePermission,
      companyId ?? undefined,
    );
  } catch (error) {
    if (!(error instanceof AuthorizationError)) {
      throw error;
    }
    return await requireActionPermission(
      fallbackWritePermission,
      companyId ?? undefined,
    );
  }
};
