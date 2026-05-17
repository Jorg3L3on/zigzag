import { redirect } from 'next/navigation';
import { checkPermission, requireActionAuth } from '@/lib/security';
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
    redirect('/dashboard/forbidden');
  }

  const allowed = await checkPermission(
    context.userId,
    companyId,
    permissionName,
  );

  if (!allowed) {
    redirect('/dashboard/forbidden');
  }

  return companyId;
}
