import { Badge } from '@/components/ui/badge';
import {
  OWNER_STATUS_NOTE,
  ownerReadinessGaps,
  type CompanyReadinessAssessment,
} from '@/lib/company-readiness';
import { companyLifecycleLabel } from '@/lib/company-lifecycle';

type CompanyReadinessPanelProps = {
  assessment: CompanyReadinessAssessment;
  /**
   * Mi empresa (ZIG-I32): the owner cannot change the status, so it is not
   * listed as pending and a note says who changes it. The operator console
   * keeps the full list.
   */
  ownerView?: boolean;
};

export const CompanyReadinessPanel = ({
  assessment,
  ownerView = false,
}: CompanyReadinessPanelProps) => {
  const pending = ownerView ? ownerReadinessGaps(assessment) : assessment.missingLabels;
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
        {ownerView && assessment.lifecycle !== 'ACTIVE' ? ` ${OWNER_STATUS_NOTE}` : null}
      </p>
      {assessment.productionReady ? (
        <p className="mt-2 text-sm text-muted-foreground">
          La empresa puede crear tickets y ejecutar flujos operativos.
        </p>
      ) : pending.length === 0 ? null : (
        <div className="mt-3">
          <p className="text-sm font-medium text-foreground">
            Requisitos pendientes
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {pending.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
