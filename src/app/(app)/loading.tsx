import { TripledDashboardShell } from '@/components/tripled';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <TripledDashboardShell>
      <div
        className="space-y-6"
        role="status"
        aria-busy="true"
        aria-live="polite"
        aria-label="Cargando sección del dashboard"
      >
        <span className="sr-only">Cargando sección del dashboard</span>
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-6">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full max-w-sm" />
            <div className="hidden rounded-xl border md:block">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="grid grid-cols-4 gap-4 border-b p-4 last:border-0"
                >
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-4/5" />
                  <Skeleton className="h-5 w-3/5" />
                  <Skeleton className="h-5 w-16 justify-self-end" />
                </div>
              ))}
            </div>
            <div className="space-y-3 md:hidden">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="space-y-3 rounded-2xl border border-border/70 bg-card p-4"
                >
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </TripledDashboardShell>
  );
}
