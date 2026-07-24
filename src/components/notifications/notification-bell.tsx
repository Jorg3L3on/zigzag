'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { FormattedDate } from '@/components/formatted-date';
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/actions/notifications';
import type { NotificationRow } from '@/db/schema';
import { useRealtimeEvents } from '@/hooks/use-realtime-events';

const POLL_INTERVAL_MS = 60_000;

const resourceHref = (row: NotificationRow): string | null => {
  if (row.resource_type === 'client_service_schedule') {
    return '/service-schedules';
  }
  if (row.resource_type === 'ticket' && row.resource_id) {
    return `/tickets/${row.resource_id}`;
  }
  return null;
};

export const NotificationBell = () => {
  const [open, setOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [items, setItems] = React.useState<NotificationRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  const refreshCount = React.useCallback(async () => {
    const result = await getUnreadNotificationCount();
    if (result.success) {
      setUnreadCount(result.data ?? 0);
    }
  }, []);

  const loadItems = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await getNotifications();
      if (result.success) {
        setItems(result.data ?? []);
        setUnreadCount(
          (result.data ?? []).filter((row) => row.read_at === null).length,
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshCount();
    const intervalId = window.setInterval(() => {
      void refreshCount();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [refreshCount]);

  React.useEffect(() => {
    if (open) {
      void loadItems();
    }
  }, [open, loadItems]);

  // Live updates via SSE (Postgres LISTEN/NOTIFY) — refresh immediately when a
  // notification or export-ready event arrives, instead of waiting for the poll.
  useRealtimeEvents(
    React.useCallback(
      (event) => {
        if (event.type === 'notification' || event.type === 'export_ready') {
          if (open) {
            void loadItems();
          } else {
            void refreshCount();
          }
        }
      },
      [open, loadItems, refreshCount],
    ),
  );

  const handleMarkRead = async (id: number) => {
    setItems((prev) =>
      prev.map((row) =>
        row.id === id && row.read_at === null
          ? { ...row, read_at: new Date() }
          : row,
      ),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    await markNotificationRead(id);
  };

  const handleMarkAll = async () => {
    setItems((prev) =>
      prev.map((row) =>
        row.read_at === null ? { ...row, read_at: new Date() } : row,
      ),
    );
    setUnreadCount(0);
    await markAllNotificationsRead();
  };

  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notificaciones${
            unreadCount > 0 ? ` (${unreadCount} sin leer)` : ''
          }`}
        >
          <Bell className="size-5" aria-hidden data-icon="inline-start"/>
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
              {badgeLabel}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <h3 className="text-sm font-semibold">Notificaciones</h3>
          {items.some((row) => row.read_at === null) ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={handleMarkAll}
            >
              <CheckCheck className="size-3.5" aria-hidden data-icon="inline-start"/>
              Marcar todo
            </Button>
          ) : null}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Cargando…
            </p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No tienes notificaciones.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {items.map((row) => {
                const href = resourceHref(row);
                const content = (
                  <div className="flex gap-3">
                    <span
                      className={
                        row.read_at === null
                          ? 'mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500'
                          : 'mt-1.5 h-2 w-2 shrink-0 rounded-full bg-transparent'
                      }
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-sm font-medium text-foreground">
                        {row.title}
                      </p>
                      {row.body ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {row.body}
                        </p>
                      ) : null}
                      <p className="text-[11px] text-muted-foreground">
                        <FormattedDate date={row.created_at} />
                      </p>
                    </div>
                  </div>
                );

                const handleClick = () => {
                  void handleMarkRead(row.id);
                  if (href) {
                    setOpen(false);
                  }
                };

                return (
                  <li key={row.id}>
                    {href ? (
                      <Link
                        href={href}
                        onClick={handleClick}
                        className="block px-4 py-3 transition hover:bg-muted/50"
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={handleClick}
                        className="block w-full px-4 py-3 text-left transition hover:bg-muted/50"
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
