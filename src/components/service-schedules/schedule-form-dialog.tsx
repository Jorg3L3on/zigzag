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
import { ScheduleIntervalPicker } from '@/components/service-schedules/schedule-interval-picker';
import {
  classifyClientError,
  getErrorMessageByType,
} from '@/lib/network-awareness';
import {
  CUSTOM_INTERVAL_PRESET_ID,
  findMatchingPresetId,
} from '@/lib/schedule-interval-presets';
import type { ScheduleIntervalUnit } from '@/lib/schedule-date';
import { cn } from '@/lib/utils';

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
      setPresetId(
        findMatchingPresetId(schedule.intervalValue, schedule.intervalUnit),
      );
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
            <Label>Cliente</Label>
            <Select
              value={clientId ? String(clientId) : undefined}
              onValueChange={(value) => setClientId(Number(value))}
              disabled={isEdit || saving}
            >
              <SelectTrigger className="min-h-11 rounded-xl" aria-label="Cliente">
                <SelectValue placeholder="Seleccionar cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={String(client.id)}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          <ScheduleIntervalPicker
            presetId={presetId}
            intervalValue={intervalValue}
            intervalUnit={intervalUnit}
            onPresetIdChange={setPresetId}
            onIntervalValueChange={setIntervalValue}
            onIntervalUnitChange={setIntervalUnit}
            disabled={saving}
          />
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
