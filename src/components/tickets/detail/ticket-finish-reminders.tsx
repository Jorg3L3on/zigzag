'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import {
  upsertClientServiceSchedule,
  type ClientServiceScheduleListItem,
} from '@/actions/client-service-schedules';
import {
  TicketFinishSchedulesDialog,
  type TicketFinishScheduleLine,
} from '@/components/service-schedules/ticket-finish-schedules-dialog';
import { useCompany } from '@/contexts/company-context';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';

type PendingReminders = {
  ticketId: number;
  clientId: number;
  ticketDate: Date;
  serviceLines: Array<{ serviceId: number; serviceName: string }>;
  existingSchedules: ClientServiceScheduleListItem[];
};

/**
 * Terminar saves the ticket and the payment first (ZIG-I36-26). Saving
 * revalidates the page, which swaps the Terminar panel for the finished layout and
 * unmounts it, so the Recordatorios question cannot live inside the panel: the panel
 * hands it to this store and `TicketFinishReminders` (always mounted) asks it.
 */
let pending: PendingReminders | null = null;
const listeners = new Set<() => void>();

const setPending = (next: PendingReminders | null) => {
  pending = next;
  listeners.forEach((listener) => listener());
};

export const openFinishReminders = (next: PendingReminders) => setPending(next);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

type TicketFinishRemindersProps = {
  ticketId: number;
};

export const TicketFinishReminders = ({ ticketId }: TicketFinishRemindersProps) => {
  const router = useRouter();
  const { selectedCompany } = useCompany();
  const current = React.useSyncExternalStore(
    subscribe,
    () => pending,
    () => null,
  );
  const [saving, setSaving] = React.useState(false);
  const open = current != null && current.ticketId === ticketId;

  // X, Escape, the overlay and Omitir all mean "no reminders": the ticket stays finished.
  const close = () => {
    setPending(null);
    router.refresh();
  };

  const confirm = async (lines: TicketFinishScheduleLine[]) => {
    if (!current) return;
    try {
      setSaving(true);
      for (const line of lines.filter((item) => item.checked)) {
        const result = await upsertClientServiceSchedule({
          clientId: current.clientId,
          serviceId: line.serviceId,
          intervalValue: line.intervalValue,
          intervalUnit: line.intervalUnit,
          lastServiceAt: line.lastServiceAt,
          companyId: selectedCompany?.id ?? null,
        });
        if (!result.success) {
          toast.error(
            result.error || 'El ticket se finalizó pero no se pudo guardar un recordatorio',
          );
        }
      }
    } catch (error) {
      console.error('Error saving schedules:', error);
      toast.error(getErrorMessageByType(classifyClientError(error), 'Ocurrió un error'));
    } finally {
      setSaving(false);
      close();
    }
  };

  if (!current || !open) return null;

  return (
    <TicketFinishSchedulesDialog
      open
      onOpenChange={(next) => {
        if (!next) close();
      }}
      ticketDate={current.ticketDate}
      serviceLines={current.serviceLines}
      existingSchedules={current.existingSchedules}
      saving={saving}
      onConfirm={(lines) => void confirm(lines)}
      onSkip={close}
    />
  );
};
