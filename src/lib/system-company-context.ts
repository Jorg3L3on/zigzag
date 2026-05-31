/**
 * Shared System company selected-Company context helpers.
 * System users must pick a tenant company before tenant-scoped reads/writes.
 */
export const needsSelectedCompanyContext = (
  isSystem: boolean,
  selectedCompanyId?: number | null,
): boolean =>
  isSystem && (selectedCompanyId == null || selectedCompanyId <= 0);

export const SYSTEM_COMPANY_CONTEXT_MESSAGE =
  'Selecciona una empresa en el menú superior para ver y gestionar datos de ese tenant.';

export const SYSTEM_COMPANY_CONTEXT_TITLE = 'Empresa no seleccionada';
