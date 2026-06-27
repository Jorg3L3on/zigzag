import { Trash2 } from 'lucide-react';
import { getTrash } from '@/actions/trash';
import { TrashView } from '@/components/trash/trash-view';
import {
  TripledDashboardShell,
  TripledPageHeader,
  TripledResourceCard,
} from '@/components/tripled';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TrashPage() {
  const result = await getTrash();
  const data = result.success
    ? (result.data ?? { clients: [], services: [], tickets: [] })
    : { clients: [], services: [], tickets: [] };

  return (
    <>
      <TripledPageHeader items={[{ label: 'Papelera' }]} />

      <TripledDashboardShell>
        <TripledResourceCard
          title="Papelera"
          description="Restaura registros eliminados de tu empresa."
          desktopDescription="Clientes, servicios y tickets eliminados que puedes restaurar."
          icon={<Trash2 className="size-5" aria-hidden />}
        >
          <TrashView data={data} />
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
