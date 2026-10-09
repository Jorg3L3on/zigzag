/**
 * Display helpers for ServicesTickets lines (ZIG-I5). A line is either a catalog
 * line (service_id set, name null, reads the Service) or an inline line
 * (service_id null, its own name/description). Every reader goes through here.
 */

export const SERVICE_LINE_FALLBACK_NAME = 'Servicio';

export type ServiceLineDisplaySource = {
  service_id?: number | null;
  name?: string | null;
  description?: string | null;
  service?: { name?: string | null; description?: string | null } | null;
};

export const isInlineServiceLine = (line: ServiceLineDisplaySource): boolean =>
  line.service_id == null;

export const getServiceLineName = (line: ServiceLineDisplaySource): string =>
  line.name?.trim() || line.service?.name?.trim() || SERVICE_LINE_FALLBACK_NAME;

export const getServiceLineDescription = (
  line: ServiceLineDisplaySource,
): string => {
  if (line.name?.trim()) {
    return line.description?.trim() ?? '';
  }
  return line.service?.description?.trim() ?? line.description?.trim() ?? '';
};
