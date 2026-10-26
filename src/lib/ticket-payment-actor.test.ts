import { matchPaymentActor, type PaymentActorEvent } from '@/lib/ticket-payment-actor';

const at = (offsetMs: number) => new Date(Date.UTC(2026, 9, 25, 12, 0, 0, offsetMs));

const event = (
  overrides: Partial<PaymentActorEvent> & Pick<PaymentActorEvent, 'eventType' | 'payload'>,
): PaymentActorEvent => ({
  createdAt: at(0),
  actorName: 'Ana',
  ...overrides,
});

describe('matchPaymentActor (ZIG-I28-2)', () => {
  const payment = { amount: 2000, createdAt: at(0) };

  it('pairs a finished event whose initial payment matches within 2 seconds', () => {
    expect(
      matchPaymentActor(payment, [
        event({
          eventType: 'finished',
          createdAt: at(2_000),
          actorName: 'Ana',
          payload: { initialPayment: 2000 },
        }),
      ]),
    ).toEqual({ initial: true, actorName: 'Ana' });
  });

  it('pairs a collected payment by payload.payment.appliedAmount within 2 seconds', () => {
    expect(
      matchPaymentActor(payment, [
        event({
          eventType: 'payment_collected',
          createdAt: at(-2_000),
          actorName: 'Luis',
          payload: { payment: { appliedAmount: 2000 } },
        }),
      ]),
    ).toEqual({ initial: false, actorName: 'Luis' });
  });

  it('returns null when the amount differs or the event is more than 2 seconds away', () => {
    const finished = event({
      eventType: 'finished',
      payload: { initialPayment: 2000 },
    });

    expect(
      matchPaymentActor(payment, [{ ...finished, payload: { initialPayment: 1999 } }]),
    ).toBeNull();
    expect(matchPaymentActor(payment, [{ ...finished, createdAt: at(2_001) }])).toBeNull();
    expect(matchPaymentActor(payment, [{ ...finished, createdAt: at(-2_001) }])).toBeNull();
  });

  it('does not match a finished event whose initial payment is 0', () => {
    expect(
      matchPaymentActor(
        { amount: 0, createdAt: at(0) },
        [
          event({
            eventType: 'finished',
            actorName: 'Ana',
            payload: { initialPayment: 0 },
          }),
        ],
      ),
    ).toBeNull();
  });
});
