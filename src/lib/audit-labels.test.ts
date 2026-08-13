import {
  formatAuditActionLabel,
  formatAuditResourceTypeLabel,
  formatAuditResultLabel,
} from '@/lib/audit-labels';

describe('audit labels', () => {
  it('maps known audit enums to Spanish labels', () => {
    expect(formatAuditActionLabel('signed_in')).toBe('Inicio de sesión');
    expect(formatAuditActionLabel('generated')).toBe('Generación');
    expect(formatAuditResultLabel('success')).toBe('Éxito');
    expect(formatAuditResultLabel('denied')).toBe('Denegado');
    expect(formatAuditResourceTypeLabel('auth')).toBe('Sesión');
    expect(formatAuditResourceTypeLabel('invoice')).toBe('Recibo');
  });

  it('falls back to the raw value for unknown codes', () => {
    expect(formatAuditActionLabel('custom_action')).toBe('custom_action');
    expect(formatAuditResultLabel('weird')).toBe('weird');
    expect(formatAuditResourceTypeLabel('widget')).toBe('widget');
  });
});
