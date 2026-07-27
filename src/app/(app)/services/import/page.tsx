import { Wrench } from 'lucide-react';
import {
  TripledDashboardShell,
  TripledPageHeader,
  TripledResourceCard,
} from '@/components/tripled';
import { ServicesCsvImportClient } from '@/components/services/services-csv-import-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function ServicesImportPage() {
  return (
    <>
      <TripledPageHeader
        items={[
          { label: 'Servicios', href: '/services' },
          { label: 'Importar CSV' },
        ]}
      />

      <TripledDashboardShell>
        <TripledResourceCard
          title="Importar servicios"
          description="Valida el CSV antes de guardar en el catálogo."
          desktopDescription="Plantilla, vista previa, progreso y resultado de la importación"
          icon={<Wrench className="size-5" aria-hidden />}
        >
          <ServicesCsvImportClient />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
