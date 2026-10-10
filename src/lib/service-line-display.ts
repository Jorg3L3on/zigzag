import { sumMaterialTotals } from '@/lib/money';

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

export const MATERIAL_LINE_FALLBACK_NAME = 'Material';

export type MaterialLineDisplaySource = {
  material_id?: number | null;
  name?: string | null;
  material?: { name?: string | null } | null;
};

/** Material rows are snapshots: their own name first, then the catalog (ZIG-I10). */
export const getMaterialLineName = (row: MaterialLineDisplaySource): string =>
  row.name?.trim() || row.material?.name?.trim() || MATERIAL_LINE_FALLBACK_NAME;

/** Inline materials (no catalog link) get the Nuevo chip like inline services. */
export const isInlineMaterialLine = (row: MaterialLineDisplaySource): boolean =>
  row.material_id == null;

/** Σ quantity × price of a line's materials (numeric columns may arrive as strings). */
export const getLineMaterialsTotal = (line: {
  materials?: ReadonlyArray<{ quantity: number | string; price: number | string }> | null;
}): number => sumMaterialTotals(line.materials);
