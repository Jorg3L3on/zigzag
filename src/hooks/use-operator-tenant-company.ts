'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { getCompanies } from '@/actions/companies';
import { useCompany } from '@/contexts/company-context';
import { resolveOperatorTenantCompanyId } from '@/lib/operator-tenant-scope';
import { usePermissions } from '@/hooks/use-permissions';

export const useOperatorTenantCompany = () => {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { selectedCompany, setSelectedCompany } = useCompany();
  const permissions = usePermissions();

  React.useEffect(() => {
    const raw = searchParams.get('tenant_company_id');
    if (!permissions.isSystem || !raw) {
      return;
    }
    const companyId = Number.parseInt(raw, 10);
    if (Number.isNaN(companyId) || selectedCompany?.id === companyId) {
      return;
    }

    const sync = async () => {
      const result = await getCompanies();
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
  }, [
    permissions.isSystem,
    searchParams,
    selectedCompany?.id,
    setSelectedCompany,
  ]);

  const tenantCompanyId = React.useMemo(() => {
    if (permissions.isSystem) {
      return resolveOperatorTenantCompanyId(true, selectedCompany);
    }
    return session?.user.company_id ?? null;
  }, [permissions.isSystem, selectedCompany, session?.user.company_id]);

  const tenantCompanyName = React.useMemo(() => {
    if (permissions.isSystem) {
      return selectedCompany?.name ?? null;
    }
    return session?.user.company_name ?? null;
  }, [permissions.isSystem, selectedCompany?.name, session?.user.company_name]);

  return {
    tenantCompanyId,
    tenantCompanyName,
    isTenantScoped: tenantCompanyId != null,
  };
};
