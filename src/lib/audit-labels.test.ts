import {
  formatAuditActionLabel,
  formatAuditResourceTypeLabel,
  formatAuditResultLabel,
  formatAuditSourceLabel,
  resolveAuditSearchCatalogMatches,
} from '@/lib/audit-labels';

describe('audit labels', () => {
  it('maps known audit enums to Spanish labels', () => {
    expect(formatAuditActionLabel('signed_in')).toBe('Inicio de sesión');
    expect(formatAuditActionLabel('generated')).toBe('Generación');
    expect(formatAuditResultLabel('success')).toBe('Éxito');
    expect(formatAuditResultLabel('denied')).toBe('Denegado');
    expect(formatAuditResourceTypeLabel('auth')).toBe('Sesión');
    expect(formatAuditResourceTypeLabel('invoice')).toBe('Recibo');
    expect(formatAuditSourceLabel('api')).toBe('API');
    expect(formatAuditSourceLabel('action')).toBe('Acción');
  });

  it('falls back to the raw value for unknown codes', () => {
    expect(formatAuditActionLabel('custom_action')).toBe('custom_action');
    expect(formatAuditResultLabel('weird')).toBe('weird');
    expect(formatAuditResourceTypeLabel('widget')).toBe('widget');
    expect(formatAuditSourceLabel('other')).toBe('other');
  });

  it('resolves Spanish search terms to catalog enum codes', () => {
    expect(resolveAuditSearchCatalogMatches('Éxito').results).toContain(
      'success',
    );
    expect(resolveAuditSearchCatalogMatches('Creación').actions).toContain(
      'created',
    );
    expect(resolveAuditSearchCatalogMatches('Cliente').resourceTypes).toContain(
      'client',
    );
    expect(resolveAuditSearchCatalogMatches('API').sources).toContain('api');
  });
});
