'use client';

import { Suspense } from 'react';
import { useOperatorTenantCompany } from '@/hooks/use-operator-tenant-company';

/**
 * Side-effect only: syncs `?tenant_company_id=` into company context for
 * System operators on any route (dashboard, tickets, users, etc.).
 */
const OperatorTenantCompanySyncInner = () => {
  useOperatorTenantCompany();
  return null;
};

export const OperatorTenantCompanySync = () => (
  <Suspense fallback={null}>
    <OperatorTenantCompanySyncInner />
  </Suspense>
);
