'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { ScheduleIntervalPicker } from '@/components/service-schedules/schedule-interval-picker';
import type { ClientServiceScheduleListItem } from '@/actions/client-service-schedules';
import {
  CUSTOM_INTERVAL_PRESET_ID,
  findMatchingPresetId,
  SCHEDULE_INTERVAL_PRESETS,
} from '@/lib/schedule-interval-presets';
import type { ScheduleIntervalUnit } from '@/lib/schedule-date';
import { cn } from '@/lib/utils';

export type TicketFinishScheduleLine = {
  serviceId: number;
  serviceName: string;
  checked: boolean;
  lastServiceAt: Date;
  intervalValue: number;
  intervalUnit: ScheduleIntervalUnit;
  presetId: string;
};

type TicketFinishSchedulesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketDate: Date;
  serviceLines: Array<{ serviceId: number; serviceName: string }>;
  existingSchedules: ClientServiceScheduleListItem[];
  saving?: boolean;
  onConfirm: (lines: TicketFinishScheduleLine[]) => void;
  onSkip: () => void;
};

const buildLineState = (
  line: { serviceId: number; serviceName: string },
  ticketDate: Date,
  existingSchedules: ClientServiceScheduleListItem[],
): TicketFinishScheduleLine => {
  const existing = existingSchedules.find(
    (schedule) => schedule.serviceId === line.serviceId,
  );

  const intervalValue = existing?.intervalValue ?? 2;
  const intervalUnit = existing?.intervalUnit ?? 'month';

  return {
    serviceId: line.serviceId,
    serviceName: line.serviceName,
    checked: Boolean(existing),
    lastServiceAt: ticketDate,
    intervalValue,
    intervalUnit,
    presetId: findMatchingPresetId(intervalValue, intervalUnit),
  };
};

export const TicketFinishSchedulesDialog = ({
  open,
  onOpenChange,
  ticketDate,
  serviceLines,
  existingSchedules,
  saving = false,
  onConfirm,
  onSkip,
}: TicketFinishSchedulesDialogProps) => {
  const [lines, setLines] = React.useState<TicketFinishScheduleLine[]>([]);

  React.useEffect(() => {
    if (!open) {
      return;
    }
    setLines(
      serviceLines.map((line) =>
        buildLineState(line, ticketDate, existingSchedules),
      ),
    );
  }, [open, serviceLines, ticketDate, existingSchedules]);

  const handleLineChange = (
    serviceId: number,
    patch: Partial<TicketFinishScheduleLine>,
  ) => {
    setLines((current) =>
      current.map((line) =>
        line.serviceId === serviceId ? { ...line, ...patch } : line,
      ),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Recordatorios de servicio</DialogTitle>
          <DialogDescription>
            Programa el próximo servicio para este cliente. Solo se guardan las
            líneas marcadas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {lines.map((line) => (
            <div
              key={line.serviceId}
              className="rounded-xl border border-border/70 p-4"
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  id={`schedule-line-${line.serviceId}`}
                  checked={line.checked}
                  disabled={saving}
                  onCheckedChange={(checked) =>
                    handleLineChange(line.serviceId, {
                      checked: checked === true,
                    })
                  }
                  aria-label={`Programar ${line.serviceName}`}
                />
                <div className="flex flex-1 flex-col gap-3">
                  <Label
                    htmlFor={`schedule-line-${line.serviceId}`}
                    className="text-sm font-semibold leading-none"
                  >
                    {line.serviceName}
                  </Label>

                  {line.checked ? (
                    <>
                      <div className="space-y-2">
                        <Label>Último servicio</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className={cn(
                                'min-h-10 w-full justify-start rounded-xl text-left font-normal',
                              )}
                              disabled={saving}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" aria-hidden />
                              {format(line.lastServiceAt, 'PPP', { locale: es })}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={line.lastServiceAt}
                              onSelect={(date) => {
                                if (date) {
                                  handleLineChange(line.serviceId, {
                                    lastServiceAt: date,
                                  });
                                }
                              }}
                              locale={es}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <ScheduleIntervalPicker
                        presetId={line.presetId}
                        intervalValue={line.intervalValue}
                        intervalUnit={line.intervalUnit}
                        onPresetIdChange={(presetId) => {
                          const patch: Partial<TicketFinishScheduleLine> = {
                            presetId,
                          };
                          if (presetId !== CUSTOM_INTERVAL_PRESET_ID) {
                            const preset = SCHEDULE_INTERVAL_PRESETS.find(
                              (item) => item.id === presetId,
                            );
                            if (preset) {
                              patch.intervalValue = preset.intervalValue;
                              patch.intervalUnit = preset.intervalUnit;
                            }
                          }
                          handleLineChange(line.serviceId, patch);
                        }}
                        onIntervalValueChange={(intervalValue) =>
                          handleLineChange(line.serviceId, { intervalValue })
                        }
                        onIntervalUnitChange={(intervalUnit) =>
                          handleLineChange(line.serviceId, { intervalUnit })
                        }
                        disabled={saving}
                      />
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-xl"
            disabled={saving}
            onClick={onSkip}
          >
            Omitir
          </Button>
          <Button
            type="button"
            className="min-h-11 rounded-xl"
            disabled={saving}
            onClick={() => onConfirm(lines)}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Guardando…
              </>
            ) : (
              'Finalizar y continuar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
