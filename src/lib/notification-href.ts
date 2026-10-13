import { SCHEDULE_DAILY_DIGEST_TYPE } from '@/lib/schedule-digest';

export type NotificationHrefSource = {
  type: string;
  resource_type: string | null;
  resource_id: string | null;
};

/**
 * Where a notification takes the user (bell click and push tap, ZIG-I20-2):
 * the schedule queue, the ticket composer prefilled for a schedule, a ticket,
 * or null when nothing to open (the export URL is a download, not a page).
 */
export const notificationHref = (row: NotificationHrefSource): string | null => {
  if (row.type === SCHEDULE_DAILY_DIGEST_TYPE) {
    const filter =
      row.resource_id === 'atrasados' || row.resource_id === 'proximos'
        ? row.resource_id
        : 'proximos';
    return `/service-schedules?filter=${filter}`;
  }

  if (row.resource_type === 'client_service_schedule' && row.resource_id) {
    const parts = row.resource_id.split(':');
    if (parts.length === 3) {
      const [, clientId, serviceId] = parts;
      return `/tickets/create?clientId=${clientId}&serviceId=${serviceId}`;
    }
    return row.type === 'schedule_overdue'
      ? '/service-schedules?filter=atrasados'
      : '/service-schedules?filter=proximos';
  }

  if (row.resource_type === 'ticket' && row.resource_id) {
    return `/tickets/${row.resource_id}`;
  }
  return null;
};
