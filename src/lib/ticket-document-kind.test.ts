import { describe, expect, it } from '@jest/globals';
import {
  getPresupuestoStatus,
  isPresupuestoMutable,
  isPresupuestoTicket,
  isWorkTicket,
  normalizeTicketDocumentKind,
  PRESUPUESTO_STATUS_LABEL,
} from '@/lib/ticket-document-kind';

describe('ticket-document-kind', () => {
  const today = new Date('2026-08-12T12:00:00');

  it('treats null/unknown as work tickets', () => {
    expect(isWorkTicket(null)).toBe(true);
    expect(isWorkTicket(undefined)).toBe(true);
    expect(isWorkTicket('ticket')).toBe(true);
    expect(isWorkTicket('presupuesto')).toBe(false);
    expect(isPresupuestoTicket('presupuesto')).toBe(true);
    expect(normalizeTicketDocumentKind('weird')).toBe('ticket');
  });

  it('reads a converted presupuesto as Aceptado (ZIG-I24)', () => {
    expect(PRESUPUESTO_STATUS_LABEL.convertido).toBe('Aceptado');
  });

  it('computes presupuesto status', () => {
    expect(
      getPresupuestoStatus(
        { document_kind: 'presupuesto', canceled_at: new Date() },
        today,
      ),
    ).toBe('cancelado');

    expect(
      getPresupuestoStatus(
        { document_kind: 'presupuesto', converted_to_ticket_id: 99 },
        today,
      ),
    ).toBe('convertido');

    expect(
      getPresupuestoStatus(
        {
          document_kind: 'presupuesto',
          expires_at: new Date('2026-08-01'),
        },
        today,
      ),
    ).toBe('vencido');

    expect(
      getPresupuestoStatus(
        {
          document_kind: 'presupuesto',
          expires_at: new Date('2026-08-20'),
        },
        today,
      ),
    ).toBe('abierto');
  });

  it('allows mutate only for open/expired unconverted quotes', () => {
    expect(
      isPresupuestoMutable(
        { document_kind: 'presupuesto', expires_at: null },
        today,
      ),
    ).toBe(true);
    expect(
      isPresupuestoMutable(
        { document_kind: 'presupuesto', converted_to_ticket_id: 1 },
        today,
      ),
    ).toBe(false);
    expect(
      isPresupuestoMutable({ document_kind: 'ticket' }, today),
    ).toBe(false);
  });

  it('counts the expiry day in the company zone, not the server one (ZIG-I29-3)', () => {
    // Stored as Mexico City midnight (06:00 UTC), as the composer saves it.
    const input = { document_kind: 'presupuesto', expires_at: new Date('2026-10-25T06:00:00Z') };
    // 19:14 in Mexico City on the 25th is already the 26th in UTC.
    expect(getPresupuestoStatus(input, new Date('2026-10-26T01:14:00Z'))).toBe('abierto');
    expect(getPresupuestoStatus(input, new Date('2026-10-26T05:59:00Z'))).toBe('abierto');
    expect(getPresupuestoStatus(input, new Date('2026-10-26T06:00:00Z'))).toBe('vencido');
  });
});
