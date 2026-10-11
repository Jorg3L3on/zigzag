import type { ClientServiceScheduleListItem } from '@/actions/client-service-schedules';
import { findMatchingPresetId } from '@/lib/schedule-interval-presets';
import type { ScheduleIntervalUnit } from '@/lib/schedule-date';

/** One catalog service a client could be reminded about (ticket finish, ZIG-I2 / ZIG-I13-3). */
export type TicketFinishScheduleLine = {
  serviceId: number;
  serviceName: string;
  checked: boolean;
  lastServiceAt: Date;
  intervalValue: number;
  intervalUnit: ScheduleIntervalUnit;
  presetId: string;
};

/**
 * Starting state of one line: a service the client already has a reminder for
 * comes checked with its interval; the rest start unchecked at 2 months.
 */
export const buildScheduleLineState = (
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
