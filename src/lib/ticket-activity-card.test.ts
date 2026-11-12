import { formatTicketActivityCardTitle } from '@/lib/ticket-activity-card';

describe('formatTicketActivityCardTitle (canvas Actividad card)', () => {
  it('says what happened with the full amount', () => {
    expect(formatTicketActivityCardTitle({ eventType: 'created', payload: null })).toBe('Ticket creado');
    expect(
      formatTicketActivityCardTitle({ eventType: 'payment_collected', payload: { appliedAmount: 421582.4 } }),
    ).toBe('Cobro registrado $421,582.40');
    expect(
      formatTicketActivityCardTitle({ eventType: 'finished', payload: { initialPayment: 500000 } }),
    ).toBe('Ticket terminado · pago inicial $500,000.00');
    expect(formatTicketActivityCardTitle({ eventType: 'finished', payload: { initialPayment: 0 } })).toBe(
      'Ticket terminado',
    );
    expect(
      formatTicketActivityCardTitle({ eventType: 'updated', payload: { servicesChanged: true } }),
    ).toBe('Servicios editados');
    expect(formatTicketActivityCardTitle({ eventType: 'updated', payload: {} })).toBe('Ticket editado');
  });
});
