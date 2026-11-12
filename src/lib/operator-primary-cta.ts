import type { CompanyLifecycleStatus } from '@/db/schema';
import { operatorTenantHref } from '@/lib/operator-tenant-scope';

export type OperatorPrimaryCtaKind =
  | 'complete_profile'
  | 'activate'
  | 'operate_as'
  | 'restore_access';

export type OperatorPrimaryCta = {
  kind: OperatorPrimaryCtaKind;
  label: string;
  href?: string;
  lifecycleTarget?: Extract<CompanyLifecycleStatus, 'ACTIVE'>;
};

export type OperatorPrimaryCtaInput = {
  companyId: number;
  lifecycle: CompanyLifecycleStatus;
  /** Profile completeness only (ZIG-I38 E2): never the lifecycle status. */
  profileReady: boolean;
  editHref: string;
};

/**
 * One primary button per lifecycle state (ZIG-I38, audit E2/E7). Archived
 * companies get none: «Exportar datos» stays as an outline action.
 */
export const resolveOperatorPrimaryCta = (
  input: OperatorPrimaryCtaInput,
): OperatorPrimaryCta | null => {
  const { companyId, lifecycle, profileReady, editHref } = input;

  if (lifecycle === 'SETUP' && !profileReady) {
    return {
      kind: 'complete_profile',
      label: 'Completar datos',
      href: operatorTenantHref(
        editHref || `/companies/${companyId}/edit`,
        companyId,
      ),
    };
  }

  if (lifecycle === 'SETUP') {
    return {
      kind: 'activate',
      label: 'Activar empresa',
      lifecycleTarget: 'ACTIVE',
    };
  }

  if (lifecycle === 'ACTIVE') {
    return {
      kind: 'operate_as',
      label: 'Operar como esta empresa',
      href: '/dashboard',
    };
  }

  if (lifecycle === 'SUSPENDED') {
    return {
      kind: 'restore_access',
      label: 'Restaurar acceso',
      lifecycleTarget: 'ACTIVE',
    };
  }

  return null;
};
