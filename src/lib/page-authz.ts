import { redirect } from 'next/navigation';
import {
  checkPermission,
  requireActionAuth,
  requireSystemUser,
} from '@/lib/security';
import { resolveWritableCompanyId } from '@/lib/authz-context';
import { getExpiredLoginPath } from '@/lib/login-redirect';

export async function requirePagePermission(
  permissionName: string,
  requestedCompanyId?: number | null,
): Promise<number> {
  let context;
  try {
    context = await requireActionAuth();
  } catch {
    redirect(getExpiredLoginPath());
  }

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

/**
 * Tenant users manage their team and roles inside the Mi empresa hub; the
 * standalone admin pages stay for system operators (and their `?tenant_company_id=` scope).
 */
export async function redirectTenantToCompanyHub(hubPath: string): Promise<void> {
  let context;
  try {
    context = await requireActionAuth();
  } catch {
    redirect(getExpiredLoginPath());
  }

  if (!context.companyIsSystem) {
    redirect(hubPath);
  }
}
