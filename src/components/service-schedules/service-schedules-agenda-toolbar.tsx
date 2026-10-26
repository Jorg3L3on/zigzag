'use client';

import { Search } from 'lucide-react';
import type { ClientServiceScheduleAgendaCounts } from '@/actions/client-service-schedules';
import { FILTER_SELECTED_CLASS } from '@/components/list-filter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { scheduleAgendaTab } from '@/lib/schedule-agenda-params';
import type { ScheduleAgendaSort, ScheduleAgendaView } from '@/lib/schedule-buckets';
import { cn } from '@/lib/utils';

const AGENDA_TABS: Array<{ id: ScheduleAgendaView; label: string }> = [
  { id: 'por-atender', label: 'Por atender' },
  { id: 'programados', label: 'Programados' },
  { id: 'pausados', label: 'Pausados' },
  { id: 'todos', label: 'Todos' },
];

const POR_ATENDER_SPLIT: Array<{ id: ScheduleAgendaView; label: string }> = [
  { id: 'por-atender', label: 'Todos' },
  { id: 'atrasados', label: 'Atrasados' },
  { id: 'proximos', label: 'Próximos' },
];

const SORT_OPTIONS: Array<{ value: ScheduleAgendaSort; label: string }> = [
  { value: 'proximo', label: 'Más atrasados primero' },
  { value: 'cliente', label: 'Cliente A–Z' },
  { value: 'ultimo', label: 'Último servicio' },
];

const ALL_SERVICES = 'all';

type ServiceSchedulesAgendaToolbarProps = {
  view: ScheduleAgendaView;
  onViewChange: (view: ScheduleAgendaView) => void;
  counts: ClientServiceScheduleAgendaCounts | null;
  searchValue: string;
  onSearchChange: (value: string) => void;
  serviceId: number | null;
  onServiceChange: (serviceId: number | null) => void;
  serviceOptions: Array<{ id: number; name: string }>;
  sort: ScheduleAgendaSort;
  onSortChange: (sort: ScheduleAgendaSort) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
};

/**
 * Agenda views and filters (ZIG-I30, canvas RecA): underlined tabs with counts
 * (never amounts), then search, Servicio and the order. Under Por atender a
 * tinted split narrows to atrasados or próximos (Hoy links them).
 */
export const ServiceSchedulesAgendaToolbar = ({
  view,
  onViewChange,
  counts,
  searchValue,
  onSearchChange,
  serviceId,
  onServiceChange,
  serviceOptions,
  sort,
  onSortChange,
  hasActiveFilters,
  onClearFilters,
}: ServiceSchedulesAgendaToolbarProps) => {
  const activeTab = scheduleAgendaTab(view);

  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Vistas de recordatorios" className="flex gap-1 border-b border-border/60">
        {AGENDA_TABS.map((tab) => {
          const selected = activeTab === tab.id;
          const count = counts ? counts[tab.id] : null;
          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onViewChange(tab.id)}
              className={cn(
                '-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                selected
                  ? 'border-primary bg-primary/10 font-semibold text-primary'
                  : 'border-transparent text-muted-foreground hover:bg-muted/50',
              )}
            >
              {tab.label}
              {count != null ? (
                <span className="tabular-nums" data-testid={`schedule-tab-count-${tab.id}`}>
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-[360px] shrink-0">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="h-11 rounded-xl bg-background pl-9 shadow-none"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar por cliente o servicio"
            aria-label="Buscar recordatorios por cliente o servicio"
          />
        </div>
        <Select
          value={serviceId ? String(serviceId) : ALL_SERVICES}
          onValueChange={(value) => onServiceChange(value === ALL_SERVICES ? null : Number(value))}
        >
          <SelectTrigger
            className={cn(
              'h-11 w-[220px] rounded-full',
              serviceId ? FILTER_SELECTED_CLASS : undefined,
            )}
            aria-label="Filtrar por servicio"
          >
            <SelectValue placeholder="Servicio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SERVICES}>Todos los servicios</SelectItem>
            {serviceOptions.map((option) => (
              <SelectItem key={option.id} value={String(option.id)}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(value) => onSortChange(value as ScheduleAgendaSort)}>
          <SelectTrigger className="h-11 w-[220px] rounded-full" aria-label="Ordenar recordatorios">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 shrink-0 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            onClick={onClearFilters}
          >
            Limpiar filtros
          </Button>
        ) : null}
      </div>

      {activeTab === 'por-atender' && counts ? (
        <div role="group" aria-label="Por atender" className="flex flex-wrap items-center gap-2">
          {POR_ATENDER_SPLIT.map((option) => {
            const pressed = view === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={pressed}
                onClick={() => onViewChange(option.id)}
                className={cn(
                  'min-h-9 rounded-full border px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                  pressed
                    ? FILTER_SELECTED_CLASS
                    : 'border-border text-muted-foreground hover:bg-muted/50',
                )}
              >
                {option.label}{' '}
                <span className="tabular-nums">{counts[option.id]}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
