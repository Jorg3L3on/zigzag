import { redirect } from 'next/navigation';
import {
  checkPermission,
  requireActionAuth,
  requireSystemUser,
} from '@/lib/security';
import { resolveWritableCompanyId } from '@/lib/authz-context';

export async function requirePagePermission(
  permissionName: string,
  requestedCompanyId?: number | null,
): Promise<number> {
  const context = await requireActionAuth();
  let companyId: number;

  try {
    companyId = resolveWritableCompanyId(context, requestedCompanyId);
  } catch {
    redirect('/forbidden');
  }

  const allowed = await checkPermission(
    context.userId,
    companyId,
    permissionName,
  );

  if (!allowed) {
    redirect('/forbidden');
  }

  return companyId;
}

export async function requireSystemPage(): Promise<void> {
  try {
    const context = await requireActionAuth();
    requireSystemUser(context);
  } catch {
    redirect('/forbidden');
  }
}
