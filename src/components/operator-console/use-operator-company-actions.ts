'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { downloadCompanyExportJson } from '@/actions/company-portability';
import { useCompany } from '@/contexts/company-context';
import { presentActionError } from '@/lib/network-awareness';

/**
 * «Operar como esta empresa» (the only console action that changes the app's
 * company: cookie and localStorage, as before) and «Exportar datos».
 */
export const useOperatorCompanyActions = () => {
  const router = useRouter();
  const { setSelectedCompany } = useCompany();
  const [exporting, setExporting] = React.useState(false);

  const operateAs = React.useCallback(
    (company: { id: number; name: string; logo: string | null }) => {
      setSelectedCompany({
        id: company.id,
        name: company.name,
        logo: () => null,
        logoUrl: company.logo,
        plan: '',
        is_system: false,
      });
      router.push('/dashboard');
    },
    [router, setSelectedCompany],
  );

  const exportData = React.useCallback(async (companyId: number): Promise<boolean> => {
    setExporting(true);
    try {
      const result = await downloadCompanyExportJson(companyId);
      if (!result.success || !result.data) {
        const content = presentActionError(result, 'No se pudo generar la exportación.');
        toast.error(content.title, { description: content.description });
        return false;
      }
      const blob = new Blob([result.data.content], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.data.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('Exportación generada.');
      return true;
    } finally {
      setExporting(false);
    }
  }, []);

  return { operateAs, exportData, exporting };
};
