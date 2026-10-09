import { describe, expect, it } from '@jest/globals';
import {
  getDefaultFieldSendHighlight,
  getFieldSendOptions,
  toFieldJobSnapshotFromAnotarSuccess,
  type FieldJobSnapshot,
} from '@/lib/field-job-snapshot';

const baseJob = (
  overrides: Partial<FieldJobSnapshot> = {},
): FieldJobSnapshot => ({
  ticketId: '10',
  clientName: 'Ana',
  clientTel: '5512345678',
  servicesSummary: 'Fumigación',
  total: 100,
  paid: 0,
  balanceDue: 100,
  finished: false,
  documentKind: 'ticket',
  ticketDate: '2026-08-12T00:00:00.000Z',
  ...overrides,
});

describe('field-job-snapshot send options', () => {
  it('offers Voy en camino for unfinished work tickets', () => {
    const options = getFieldSendOptions(baseJob());
    expect(options.map((o) => o.id)).toEqual(['voy_en_camino']);
    expect(options[0]?.enabled).toBe(true);
  });

  it('disables WhatsApp options without phone', () => {
    const options = getFieldSendOptions(baseJob({ clientTel: null }));
    expect(options[0]?.enabled).toBe(false);
    expect(options[0]?.disabledReason).toMatch(/teléfono/i);
  });

  it('offers recibo and saldo for finished tickets with balance', () => {
    const options = getFieldSendOptions(
      baseJob({ finished: true, paid: 40, balanceDue: 60 }),
    );
    expect(options.map((o) => o.id)).toEqual([
      'enviar_recibo',
      'recordar_saldo',
    ]);
  });

  it('offers presupuesto for mutable quotes', () => {
    const options = getFieldSendOptions(
      baseJob({
        documentKind: 'presupuesto',
        finished: false,
        presupuestoMutable: true,
        balanceDue: 0,
      }),
    );
    expect(options.map((o) => o.id)).toEqual(['enviar_presupuesto']);
  });

  it('labels offline recibo when offline', () => {
    const options = getFieldSendOptions(
      baseJob({ finished: true, paid: 100, balanceDue: 0 }),
      { online: false },
    );
    expect(options[0]?.label).toMatch(/Recibo simple/i);
  });

  it('highlights recibo after paid anotar success', () => {
    const job = toFieldJobSnapshotFromAnotarSuccess({
      ticketId: 99,
      clientName: 'Ana',
      clientTel: '5512345678',
      total: 200,
      paid: 200,
      finished: true,
      companyName: 'Demo',
    });
    expect(getDefaultFieldSendHighlight(job)).toBe('enviar_recibo');
  });
});
