import type { CompanyLifecycleStatus } from '@/db/schema';

export type OperatorPrimaryCtaKind =
  | 'complete_go_live'
  | 'activate'
  | 'open_dashboard'
  | 'restore_access'
  | 'edit_company';

export type OperatorPrimaryCta = {
  kind: OperatorPrimaryCtaKind;
  label: string;
  href?: string;
  lifecycleTarget?: Extract<CompanyLifecycleStatus, 'ACTIVE'>;
};

export type OperatorPrimaryCtaInput = {
  companyId: number;
  lifecycle: CompanyLifecycleStatus;
  productionReady: boolean;
  editHref: string;
};

export const resolveOperatorPrimaryCta = (
  input: OperatorPrimaryCtaInput,
): OperatorPrimaryCta => {
  const { companyId, lifecycle, productionReady, editHref } = input;

  if (lifecycle === 'SETUP' && !productionReady) {
    return {
      kind: 'complete_go_live',
      label: 'Completar go-live',
      href: editHref,
    };
  }

  if (lifecycle === 'SETUP' && productionReady) {
    return {
      kind: 'activate',
      label: 'Activar empresa',
      lifecycleTarget: 'ACTIVE',
    };
  }

  if (lifecycle === 'ACTIVE') {
    return {
      kind: 'open_dashboard',
      label: 'Abrir dashboard',
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

  return {
    kind: 'edit_company',
    label: 'Editar empresa',
    href: editHref || `/companies/${companyId}/edit`,
  };
};
