'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCompany } from '@/contexts/company-context';
import { resolveOperatorTenantCompanyId } from '@/lib/operator-tenant-scope';

export const useOperatorTenantCompany = () => {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { selectedCompany, setSelectedCompany } = useCompany();
  const isSystem = Boolean(session?.user?.company_is_system);

  React.useEffect(() => {
    const raw = searchParams.get('tenant_company_id');
    if (!isSystem || !raw) {
      return;
    }
    const companyId = Number.parseInt(raw, 10);
    if (Number.isNaN(companyId) || selectedCompany?.id === companyId) {
      return;
    }

    let cancelled = false;

    const sync = async () => {
      // Dynamic import keeps server-action/auth out of the static client graph
      // (app chrome / layout tests must not pull next-auth ESM at module load).
      const { getCompanies } = await import('@/actions/companies');
      if (cancelled) {
        return;
      }
      const result = await getCompanies();
      if (cancelled) {
        return;
      }
      const row = result.data?.find((company) => company.id === companyId);
      if (!row || row.is_system) {
        return;
      }
      setSelectedCompany({
        id: row.id,
        name: row.name,
        logo: () => null,
        logoUrl: row.logo,
        plan: '',
        is_system: row.is_system,
      });
    };

    void sync();

    return () => {
      cancelled = true;
    };
  }, [isSystem, searchParams, selectedCompany?.id, setSelectedCompany]);

  const tenantCompanyId = React.useMemo(() => {
    if (isSystem) {
      return resolveOperatorTenantCompanyId(true, selectedCompany);
    }
    return session?.user.company_id ?? null;
  }, [isSystem, selectedCompany, session?.user.company_id]);

  const tenantCompanyName = React.useMemo(() => {
    if (isSystem) {
      return selectedCompany?.name ?? null;
    }
    return session?.user.company_name ?? null;
  }, [isSystem, selectedCompany?.name, session?.user.company_name]);

  return {
    tenantCompanyId,
    tenantCompanyName,
    isTenantScoped: tenantCompanyId != null,
  };
};
