'use client';

import Link from 'next/link';
import React from 'react';
import { getOwnCompanyReadiness } from '@/actions/companies';
import { useCompany } from '@/contexts/company-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TriangleAlert } from 'lucide-react';

export const CompanyProductionNotice = () => {
  const { selectedCompany } = useCompany();
  const [missingLabels, setMissingLabels] = React.useState<string[] | null>(
    null,
  );

  React.useEffect(() => {
    const companyId = selectedCompany?.id;
    if (!companyId || selectedCompany?.name === 'System') {
      setMissingLabels(null);
      return;
    }

    const load = async () => {
      const result = await getOwnCompanyReadiness();
      if (!result.success || !result.data || result.data.productionReady) {
        setMissingLabels(null);
        return;
      }

      setMissingLabels(result.data.missingLabels);
    };

    void load();
  }, [selectedCompany?.id, selectedCompany?.name]);

  if (!missingLabels?.length || !selectedCompany?.id) {
    return null;
  }

  return (
    <Alert variant="destructive" className="mb-4">
      <TriangleAlert className="size-4" aria-hidden />
      <AlertTitle>Empresa no lista para operar</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          Completa la configuración de la empresa antes de crear tickets:{' '}
          {missingLabels.join(', ')}.
        </p>
        <Button asChild variant="outline" size="sm" className="h-9">
          <Link href="/company">Completar configuración</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
};
