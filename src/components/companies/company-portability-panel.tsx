'use client';

import React from 'react';
import { toast } from 'sonner';
import type { Company } from '@/db/schema';
import {
  downloadCompanyExportJson,
  offboardCompany,
} from '@/actions/company-portability';
import { COMPANY_OFFBOARDING_RETENTION_POLICY, canStartCompanyOffboarding } from '@/lib/company-offboarding';
import { companyLifecycleLabel } from '@/lib/company-lifecycle';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Download, Archive } from 'lucide-react';
import {
  classifyClientError,
  getErrorDisplayMessage,
} from '@/lib/network-awareness';

type CompanyPortabilityPanelProps = {
  company: Company;
};

export const CompanyPortabilityPanel = ({
  company,
}: CompanyPortabilityPanelProps) => {
  const [isExporting, setIsExporting] = React.useState(false);
  const [isOffboarding, setIsOffboarding] = React.useState(false);
  const offboardingEligibility = canStartCompanyOffboarding(company);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await downloadCompanyExportJson(company.id);
      if (!result.success || !result.data) {
        toast.error(
          getErrorDisplayMessage(
            null,
            result.error ?? 'No se pudo generar la exportación.',
            classifyClientError(result.errorType),
          ),
        );
        return;
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
    } finally {
      setIsExporting(false);
    }
  };

  const handleOffboard = async () => {
    setIsOffboarding(true);
    try {
      const result = await offboardCompany(company.id);
      if (!result.success || !result.data) {
        toast.error(
          getErrorDisplayMessage(
            null,
            result.error ?? 'No se pudo iniciar el offboarding.',
            classifyClientError(result.errorType),
          ),
        );
        return;
      }

      toast.success(
        `Empresa archivada. Retención hasta ${new Date(result.data.summary.retention_ends_at).toLocaleDateString('es-MX')}.`,
      );
      window.location.reload();
    } finally {
      setIsOffboarding(false);
    }
  };

  return (
    <section
      aria-labelledby="company-portability-heading"
      className="space-y-4 rounded-lg border p-4"
    >
      <div>
        <h3
          id="company-portability-heading"
          className="text-base font-semibold"
        >
          Portabilidad y offboarding
        </h3>
        <p className="text-sm text-muted-foreground">
          Exporta datos de la empresa para solicitudes de portabilidad. El
          offboarding archiva la empresa sin borrar registros.
        </p>
      </div>

      <Alert>
        <AlertTitle>Retención ({COMPANY_OFFBOARDING_RETENTION_POLICY.policy_version})</AlertTitle>
        <AlertDescription>
          {COMPANY_OFFBOARDING_RETENTION_POLICY.summary}
        </AlertDescription>
      </Alert>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={isExporting}
          onClick={handleExport}
          aria-label="Descargar exportación JSON de la empresa"
        >
          <Download className="mr-2 size-4" aria-hidden />
          {isExporting ? 'Generando exportación…' : 'Exportar datos (JSON)'}
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11"
              disabled={!offboardingEligibility.allowed || isOffboarding}
              aria-label="Archivar empresa e iniciar offboarding"
            >
              <Archive className="mr-2 size-4" aria-hidden />
              {isOffboarding ? 'Archivando…' : 'Iniciar offboarding'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Archivar esta empresa?</AlertDialogTitle>
              <AlertDialogDescription>
                La empresa pasará a estado{' '}
                <strong>{companyLifecycleLabel('ARCHIVED')}</strong>. Los datos
                se conservan{' '}
                {COMPANY_OFFBOARDING_RETENTION_POLICY.retention_days_after_archive}{' '}
                días antes de una posible purga manual. Los usuarios no podrán
                iniciar sesión.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleOffboard}>
                Confirmar offboarding
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {!offboardingEligibility.allowed ? (
        <p className="text-sm text-muted-foreground" role="status">
          Offboarding no disponible: {offboardingEligibility.reason}
        </p>
      ) : null}
    </section>
  );
};
