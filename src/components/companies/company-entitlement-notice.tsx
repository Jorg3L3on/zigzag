'use client';

import React from 'react';
import { getCompanyEntitlements } from '@/actions/company-entitlements';
import { useCompany } from '@/contexts/company-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TriangleAlert } from 'lucide-react';

type CompanyEntitlementNoticeProps = {
  metric: 'users' | 'clients' | 'services' | 'tickets_month';
};

export const CompanyEntitlementNotice = ({
  metric,
}: CompanyEntitlementNoticeProps) => {
  const { selectedCompany } = useCompany();
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    const companyId = selectedCompany?.id;
    if (!companyId) {
      setMessage(null);
      return;
    }

    const load = async () => {
      const result = await getCompanyEntitlements(companyId);
      if (!result.success || !result.data) {
        return;
      }

      const row = result.data.metrics.find((item) => item.metric === metric);
      if (!row || row.allowed) {
        setMessage(null);
        return;
      }

      setMessage(
        `Plan ${result.data.planLabel}: límite de ${row.limit} ${row.label} alcanzado (${row.usage} en uso).`,
      );
    };

    void load();
  }, [metric, selectedCompany?.id]);

  if (!message) {
    return null;
  }

  return (
    <Alert variant="destructive" className="mb-4">
      <TriangleAlert className="size-4" aria-hidden />
      <AlertTitle>Límite del plan alcanzado</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
};
