import {
  normalizeClientNotes,
  summarizeClientBalance,
} from '@/lib/client-detail';

describe('summarizeClientBalance', () => {
  it('sums the unpaid amount of finished work tickets only', () => {
    const summary = summarizeClientBalance([
      { document_kind: 'ticket', finished: true, total: 1000, paid: 400 },
      { document_kind: 'ticket', finished: true, total: 500, paid: 0 },
      // Saldado: owes nothing.
      { document_kind: 'ticket', finished: true, total: 300, paid: 300 },
      // Still being worked on: not collectable yet.
      { document_kind: 'ticket', finished: false, total: 900, paid: 0 },
      // Presupuestos never count.
      { document_kind: 'presupuesto', finished: true, total: 700, paid: 0 },
    ]);
    expect(summary).toEqual({ balanceDue: 1100, dueTicketCount: 2, ticketCount: 4 });
  });

  it('treats a missing document kind as a work ticket', () => {
    expect(
      summarizeClientBalance([{ finished: true, total: 250.5, paid: null }]),
    ).toEqual({ balanceDue: 250.5, dueTicketCount: 1, ticketCount: 1 });
  });

  it('ignores differences below one cent and rounds to cents', () => {
    const summary = summarizeClientBalance([
      { document_kind: 'ticket', finished: true, total: 100, paid: 99.995 },
      { document_kind: 'ticket', finished: true, total: 10.1, paid: 0 },
      { document_kind: 'ticket', finished: true, total: 20.2, paid: 0 },
    ]);
    expect(summary.balanceDue).toBe(30.3);
    expect(summary.dueTicketCount).toBe(2);
  });

  it('returns zeros for a client without documents', () => {
    expect(summarizeClientBalance([])).toEqual({
      balanceDue: 0,
      dueTicketCount: 0,
      ticketCount: 0,
    });
  });
});

describe('normalizeClientNotes', () => {
  it('trims text and stores empty notes as null', () => {
    expect(normalizeClientNotes('  Portón azul  ')).toBe('Portón azul');
    expect(normalizeClientNotes('   ')).toBeNull();
    expect(normalizeClientNotes(null)).toBeNull();
    expect(normalizeClientNotes(undefined)).toBeNull();
  });
});
