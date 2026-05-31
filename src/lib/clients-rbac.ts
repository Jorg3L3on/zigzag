import { PERMISSIONS } from '@/lib/permissions';
import { createResourceRbacContract } from '@/lib/resource-rbac-factory';

const base = createResourceRbacContract(
  PERMISSIONS.clients.read,
  PERMISSIONS.clients.write,
);

export const CLIENTS_READ_PERMISSION = base.readPermission;
export const CLIENTS_WRITE_PERMISSION = base.writePermission;
export const canReadClients = base.canRead;
export const canWriteClients = base.canWrite;
