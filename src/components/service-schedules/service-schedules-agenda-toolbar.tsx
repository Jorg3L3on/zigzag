'use client';

import type { ClientServiceScheduleAgendaCounts } from '@/actions/client-service-schedules';
import {
  FILTER_SELECTED_CLASS,
  ListFilterSelect,
  ListToolbar,
  ListViewTabs,
  type ListViewTab,
} from '@/components/list-page';
import { scheduleAgendaTab } from '@/lib/schedule-agenda-params';
import type { ScheduleAgendaView } from '@/lib/schedule-buckets';
import { cn } from '@/lib/utils';

type AgendaTabId = 'por-atender' | 'programados' | 'pausados' | 'todos';

const AGENDA_TABS: Array<{ id: AgendaTabId; label: string; dot: string | null }> = [
  { id: 'por-atender', label: 'Por atender', dot: 'bg-amber-500' },
  { id: 'programados', label: 'Programados', dot: 'bg-emerald-500' },
  { id: 'pausados', label: 'Pausados', dot: 'bg-slate-400' },
  { id: 'todos', label: 'Todos', dot: null },
];

const POR_ATENDER_SPLIT: Array<{ id: ScheduleAgendaView; label: string }> = [
  { id: 'por-atender', label: 'Todos' },
  { id: 'atrasados', label: 'Atrasados' },
  { id: 'proximos', label: 'Próximos' },
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
  hasActiveFilters: boolean;
  onClearFilters: () => void;
};

/**
 * Agenda views and filters (ZIG-I30, canvas RecA; list standard ZIG-I33-5): the
 * shared view tabs with counts (never amounts), then the filter row with search and
 * Servicio. The order is the column headers', not a select. Under Por atender a
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
  hasActiveFilters,
  onClearFilters,
}: ServiceSchedulesAgendaToolbarProps) => {
  const activeTab = scheduleAgendaTab(view);
  const tabs: ListViewTab<AgendaTabId>[] = AGENDA_TABS.map((tab) => ({
    id: tab.id,
    label: tab.label,
    dot: tab.dot,
    count: counts ? counts[tab.id] : null,
    caption: counts ? (
      <span data-testid={`schedule-tab-count-${tab.id}`}>{counts[tab.id]}</span>
    ) : null,
  }));
  const serviceFilterOptions = [
    { value: ALL_SERVICES, label: 'Todos los servicios' },
    ...serviceOptions.map((option) => ({ value: String(option.id), label: option.name })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <ListViewTabs
        label="Vistas de recordatorios"
        tabs={tabs}
        isSelected={(id) => activeTab === id}
        onSelect={onViewChange}
      />

      <ListToolbar
        search={{
          value: searchValue,
          onChange: onSearchChange,
          placeholder: 'Buscar por cliente o servicio',
          ariaLabel: 'Buscar recordatorios por cliente o servicio',
        }}
        filters={
          <ListFilterSelect
            value={serviceId ? String(serviceId) : ALL_SERVICES}
            allValue={ALL_SERVICES}
            onChange={(value) => onServiceChange(value === ALL_SERVICES ? null : Number(value))}
            options={serviceFilterOptions}
            ariaLabel="Filtrar por servicio"
          />
        }
        hasActiveFilters={hasActiveFilters}
        onClear={onClearFilters}
      />

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
