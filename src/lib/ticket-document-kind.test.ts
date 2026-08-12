import { describe, expect, it } from '@jest/globals';
import {
  getPresupuestoStatus,
  isPresupuestoMutable,
  isPresupuestoTicket,
  isWorkTicket,
  normalizeTicketDocumentKind,
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
});
