import { TripledPageHeader } from '@/components/tripled';

export default function ForbiddenPage() {
  return (
    <>
      <TripledPageHeader items={[{ label: 'Acceso denegado' }]} />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold">No tienes acceso</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu rol no tiene permiso para ver esta sección.
          </p>
        </div>
      </div>
    </>
  );
}
