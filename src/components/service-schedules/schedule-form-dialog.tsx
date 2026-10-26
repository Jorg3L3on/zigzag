'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  listServiceScheduleFormCatalog,
  upsertClientServiceSchedule,
  type ClientServiceScheduleListItem,
  type ServiceScheduleFormCatalogClient,
} from '@/actions/client-service-schedules';
import type { Service } from '@/db/schema';
import { useCompany } from '@/contexts/company-context';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { FILTER_SELECTED_CLASS } from '@/components/list-filter';
import {
  classifyClientError,
  getErrorMessageByType,
} from '@/lib/network-awareness';
import {
  CUSTOM_INTERVAL_PRESET_ID,
  findMatchingPresetId,
} from '@/lib/schedule-interval-presets';
import { computeNextDueAt, type ScheduleIntervalUnit } from '@/lib/schedule-date';
import { formatScheduleLongDate, localDateToIsoDay } from '@/lib/schedule-agenda-format';
import { cn } from '@/lib/utils';

/** Cada: chips for the usual intervals (ZIG-I30), Otro… opens amount and unit. */
const INTERVAL_CHIPS: Array<{ id: string; label: string; months: number }> = [
  { id: '1m', label: '1', months: 1 },
  { id: '2m', label: '2', months: 2 },
  { id: '3m', label: '3', months: 3 },
  { id: '6m', label: '6', months: 6 },
  { id: '12m', label: '12 meses', months: 12 },
];

const chipIdFor = (intervalValue: number, intervalUnit: ScheduleIntervalUnit): string => {
  const match = findMatchingPresetId(intervalValue, intervalUnit);
  return INTERVAL_CHIPS.some((chip) => chip.id === match) ? match : CUSTOM_INTERVAL_PRESET_ID;
};

type ScheduleFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule?: ClientServiceScheduleListItem | null;
  onSaved: () => void;
};

export const ScheduleFormDialog = ({
  open,
  onOpenChange,
  schedule,
  onSaved,
}: ScheduleFormDialogProps) => {
  const { selectedCompany } = useCompany();
  const isEdit = Boolean(schedule);
  const [saving, setSaving] = React.useState(false);
  const [clients, setClients] = React.useState<ServiceScheduleFormCatalogClient[]>([]);
  const [services, setServices] = React.useState<Service[]>([]);
  const [clientId, setClientId] = React.useState<number | null>(null);
  const [serviceId, setServiceId] = React.useState<number | null>(null);
  const [lastServiceAt, setLastServiceAt] = React.useState<Date>(new Date());
  const [presetId, setPresetId] = React.useState('2m');
  const [intervalValue, setIntervalValue] = React.useState(2);
  const [intervalUnit, setIntervalUnit] =
    React.useState<ScheduleIntervalUnit>('month');

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const loadCatalog = async () => {
      const result = await listServiceScheduleFormCatalog(
        selectedCompany?.id ?? null,
      );
      if (result.success && result.data) {
        setClients(result.data.clients);
        setServices(result.data.services);
        return;
      }

      const errorType = classifyClientError(null, undefined, result.errorType);
      toast.error(
        getErrorMessageByType(
          errorType,
          result.error || 'No se pudo cargar el catálogo',
        ),
      );
    };

    void loadCatalog();
  }, [open, selectedCompany?.id]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    if (schedule) {
      setClientId(schedule.clientId);
      setServiceId(schedule.serviceId);
      setLastServiceAt(
        schedule.lastServiceAt ? new Date(schedule.lastServiceAt) : new Date(),
      );
      setIntervalValue(schedule.intervalValue);
      setIntervalUnit(schedule.intervalUnit);
      setPresetId(chipIdFor(schedule.intervalValue, schedule.intervalUnit));
      return;
    }

    setClientId(null);
    setServiceId(null);
    setLastServiceAt(new Date());
    setPresetId('2m');
    setIntervalValue(2);
    setIntervalUnit('month');
  }, [open, schedule]);

  const handleSave = async () => {
    if (!clientId || !serviceId) {
      toast.error('Selecciona cliente y servicio');
      return;
    }

    setSaving(true);
    try {
      const result = await upsertClientServiceSchedule({
        clientId,
        serviceId,
        intervalValue,
        intervalUnit,
        lastServiceAt,
        companyId: selectedCompany?.id ?? null,
      });

      if (result.success) {
        toast.success(isEdit ? 'Recordatorio actualizado' : 'Recordatorio creado');
        onOpenChange(false);
        onSaved();
      } else {
        const errorType = classifyClientError(null, undefined, result.errorType);
        toast.error(
          getErrorMessageByType(
            errorType,
            result.error || 'No se pudo guardar el recordatorio',
          ),
        );
      }
    } catch (error) {
      const errorType = classifyClientError(error);
      toast.error(getErrorMessageByType(errorType, 'No se pudo guardar'));
    } finally {
      setSaving(false);
    }
  };

  const nextDuePreview =
    intervalValue >= 1
      ? formatScheduleLongDate(
          localDateToIsoDay(computeNextDueAt(lastServiceAt, intervalValue, intervalUnit)),
        )
      : null;

  const handleChip = (chipId: string) => {
    setPresetId(chipId);
    const chip = INTERVAL_CHIPS.find((item) => item.id === chipId);
    if (chip) {
      setIntervalValue(chip.months);
      setIntervalUnit('month');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar recordatorio' : 'Nuevo recordatorio'}
          </DialogTitle>
          <DialogDescription>
            Programa el próximo servicio para un cliente y servicio específicos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="schedule-form-client">Cliente</Label>
            <SearchableSelect
              id="schedule-form-client"
              aria-label="Cliente"
              options={clients.map((item) => ({ value: String(item.id), label: item.name }))}
              value={clientId ? String(clientId) : ''}
              onValueChange={(value) => setClientId(value ? Number(value) : null)}
              placeholder="Buscar cliente"
              searchPlaceholder="Nombre del cliente"
              emptyText="Ningún cliente con ese nombre"
              disabled={isEdit || saving}
              className="min-h-11 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label>Servicio</Label>
            <Select
              value={serviceId ? String(serviceId) : undefined}
              onValueChange={(value) => setServiceId(Number(value))}
              disabled={isEdit || saving}
            >
              <SelectTrigger className="min-h-11 rounded-xl" aria-label="Servicio">
                <SelectValue placeholder="Seleccionar servicio" />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={String(service.id)}>
                    {service.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Último servicio</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    'min-h-11 w-full justify-start rounded-xl text-left font-normal',
                    !lastServiceAt && 'text-muted-foreground',
                  )}
                  disabled={saving}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" aria-hidden  data-icon="inline-start" />
                  {lastServiceAt
                    ? format(lastServiceAt, 'PPP', { locale: es })
                    : 'Seleccionar fecha'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={lastServiceAt}
                  onSelect={(date) => date && setLastServiceAt(date)}
                  locale={es}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label id="schedule-form-every">Cada</Label>
            <div role="group" aria-labelledby="schedule-form-every" className="flex flex-wrap gap-2">
              {[...INTERVAL_CHIPS, { id: CUSTOM_INTERVAL_PRESET_ID, label: 'Otro…', months: 0 }].map(
                (chip) => {
                  const pressed = presetId === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      aria-pressed={pressed}
                      aria-label={
                        chip.months
                          ? `${chip.months} ${chip.months === 1 ? 'mes' : 'meses'}`
                          : 'Otro intervalo'
                      }
                      disabled={saving}
                      onClick={() => handleChip(chip.id)}
                      className={cn(
                        'min-h-11 min-w-11 rounded-full border px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                        pressed
                          ? FILTER_SELECTED_CLASS
                          : 'border-border text-muted-foreground hover:bg-muted/50',
                      )}
                    >
                      {chip.label}
                    </button>
                  );
                },
              )}
            </div>
            {presetId === CUSTOM_INTERVAL_PRESET_ID ? (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <Input
                  type="number"
                  min={1}
                  aria-label="Cantidad"
                  className="min-h-11 rounded-xl"
                  value={intervalValue}
                  disabled={saving}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    setIntervalValue(Number.isFinite(parsed) ? Math.max(1, parsed) : 1);
                  }}
                />
                <Select
                  value={intervalUnit}
                  onValueChange={(value) => setIntervalUnit(value as ScheduleIntervalUnit)}
                  disabled={saving}
                >
                  <SelectTrigger className="min-h-11 rounded-xl" aria-label="Unidad">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Meses</SelectItem>
                    <SelectItem value="day">Días</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          {nextDuePreview ? (
            <p
              className="rounded-xl bg-muted/50 px-3 py-2 text-sm"
              data-testid="schedule-form-preview"
            >
              Próximo recordatorio: {nextDuePreview}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-xl"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="min-h-11 rounded-xl"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden data-icon="inline-start"/>
                Guardando…
              </>
            ) : (
              'Guardar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
