import { Badge } from '@/components/ui/badge';
import type { CompanyReadinessAssessment } from '@/lib/company-readiness';
import { companyLifecycleLabel } from '@/lib/company-lifecycle';

type CompanyReadinessPanelProps = {
  assessment: CompanyReadinessAssessment;
};

export const CompanyReadinessPanel = ({
  assessment,
}: CompanyReadinessPanelProps) => {
  return (
    <section
      className="rounded-lg border border-border bg-muted/30 p-4"
      aria-labelledby="company-readiness-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3
          id="company-readiness-heading"
          className="text-sm font-semibold text-foreground"
        >
          Preparación para operar
        </h3>
        <Badge variant={assessment.productionReady ? 'default' : 'secondary'}>
          {assessment.productionReady ? 'Lista' : 'Pendiente'}
        </Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Estado del ciclo de vida:{' '}
        <span className="font-medium text-foreground">
          {companyLifecycleLabel(assessment.lifecycle)}
        </span>
      </p>
      {assessment.productionReady ? (
        <p className="mt-2 text-sm text-muted-foreground">
          La empresa puede crear tickets y ejecutar flujos operativos.
        </p>
      ) : (
        <div className="mt-3">
          <p className="text-sm font-medium text-foreground">
            Requisitos pendientes
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {assessment.missingLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
