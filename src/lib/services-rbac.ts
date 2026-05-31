import { PERMISSIONS } from '@/lib/permissions';
import { createResourceRbacContract } from '@/lib/resource-rbac-factory';

const base = createResourceRbacContract(
  PERMISSIONS.services.read,
  PERMISSIONS.services.write,
);

export const SERVICES_READ_PERMISSION = base.readPermission;
export const SERVICES_WRITE_PERMISSION = base.writePermission;
export const canReadServices = base.canRead;
export const canWriteServices = base.canWrite;
