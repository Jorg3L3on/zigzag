'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Building2,
  CheckCircle2,
  FileText,
  LogIn,
  LogOut,
  Package,
  Receipt,
  Ticket,
  UserRound,
  Users,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DASHBOARD_CARD_CLASS } from '@/components/dashboard/dashboard-surface';
import { TripledEmptyState } from '@/components/tripled';
import {
  fetchDashboardActivity,
  type DashboardActivityResponse,
} from '@/actions/dashboard-activity';
import type {
  ActivityFeedIconKey,
  ActivityFeedItem,
} from '@/lib/activity-feed';
import { formatRelativeActivityTime } from '@/lib/format-relative-time';
import { getErrorDisplayMessage } from '@/lib/network-awareness';
import { useCompany } from '@/contexts/company-context';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<
  ActivityFeedIconKey,
  React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
> = {
  ticket: Ticket,
  payment: Receipt,
  invoice: FileText,
  client: Users,
  service: Package,
  user: UserRound,
  company: Building2,
  auth: LogIn,
  generic: Activity,
};

const ActivityIcon = ({
  icon,
  signedOut,
}: {
  icon: ActivityFeedIconKey;
  signedOut?: boolean;
}) => {
  const Icon =
    icon === 'auth' && signedOut ? LogOut : ICON_MAP[icon] ?? Activity;
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  );
};

const ActivityRow = ({ item }: { item: ActivityFeedItem }) => {
  const relative = formatRelativeActivityTime(item.occurredAt);
  const content = (
    <>
      <ActivityIcon
        icon={item.icon}
        signedOut={item.action === 'signed_out'}
      />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium leading-snug text-foreground">
          {item.title}
        </p>
        {item.description ? (
          <p className="text-xs text-muted-foreground">{item.description}</p>
        ) : null}
      </div>
      <time
        className="shrink-0 text-xs tabular-nums text-muted-foreground"
        dateTime={item.occurredAt}
        title={new Date(item.occurredAt).toLocaleString('es-MX')}
      >
        {relative}
      </time>
    </>
  );

  if (item.href) {
    return (
      <li>
        <Link
          href={item.href}
          className="flex items-start gap-3 rounded-lg px-1 py-3 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
        >
          {content}
        </Link>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-3 px-1 py-3">
      {content}
    </li>
  );
};

const FeedSkeleton = () => (
  <div className="space-y-3" role="status" aria-label="Cargando actividad reciente">
    {Array.from({ length: 5 }).map((_, index) => (
      <div key={index} className="flex items-start gap-3 py-2">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <Skeleton className="h-3 w-16" />
      </div>
    ))}
  </div>
);

export const DashboardActivityFeed = () => {
  const { data: session } = useSession();
  const { selectedCompany } = useCompany();
  const [items, setItems] = React.useState<ActivityFeedItem[]>([]);
  const [nextCursor, setNextCursor] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const companyIdArg = React.useMemo(() => {
    if (session?.user.company_is_system) {
      return selectedCompany?.id ?? session.user.company_id;
    }
    return undefined;
  }, [
    selectedCompany?.id,
    session?.user.company_id,
    session?.user.company_is_system,
  ]);

  const load = React.useCallback(
    async (cursor?: number) => {
      const isAppend = cursor != null;
      if (isAppend) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const result: DashboardActivityResponse = await fetchDashboardActivity({
        companyId: companyIdArg,
        cursor,
        limit: 15,
      });

      if (isAppend) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }

      if (!result.success || !result.data) {
        setError(
          getErrorDisplayMessage(
            result,
            'No se pudo cargar la actividad reciente',
            result.errorType,
          ),
        );
        return;
      }

      setNextCursor(result.data.nextCursor);
      setItems((current) =>
        isAppend ? [...current, ...result.data!.items] : result.data!.items,
      );
    },
    [companyIdArg],
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleLoadMore = () => {
    if (nextCursor == null || loadingMore) {
      return;
    }
    void load(nextCursor);
  };

  return (
    <section
      className={cn(DASHBOARD_CARD_CLASS, 'flex h-full flex-col rounded-xl border')}
      aria-label="Actividad reciente"
    >
      <div className="flex items-start justify-between gap-2 p-4 pb-2 sm:p-5 sm:pb-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold tracking-tight sm:text-lg">
            Actividad reciente
          </h3>
          <p className="text-sm text-muted-foreground">
            Lo que tu equipo ha hecho últimamente
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-3 pb-4 sm:px-4 sm:pb-5">
        {loading ? (
          <FeedSkeleton />
        ) : error ? (
          <TripledEmptyState
            icon={<Activity className="h-4 w-4" />}
            title="Error al cargar"
            description={error}
            role="alert"
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void load()}
              >
                Reintentar
              </Button>
            }
          />
        ) : items.length === 0 ? (
          <TripledEmptyState
            icon={<CheckCircle2 className="h-4 w-4" />}
            title="Sin actividad reciente"
            description="Aún no hay actividad reciente. Cuando tu equipo use ZigZag, los eventos importantes aparecerán aquí."
          />
        ) : (
          <>
            <ul className="divide-y divide-border/40">
              {items.map((item) => (
                <ActivityRow key={item.id} item={item} />
              ))}
            </ul>
            {nextCursor != null ? (
              <div className="mt-3 flex justify-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  disabled={loadingMore}
                  onClick={handleLoadMore}
                >
                  {loadingMore ? 'Cargando…' : 'Cargar más'}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
};
