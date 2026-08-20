import { describe, expect, it } from '@jest/globals';
import {
  getDefaultFieldSendHighlight,
  getFieldSendOptions,
  pickHoyCobranzaRows,
  toFieldJobSnapshotFromAnotarSuccess,
  type FieldJobSnapshot,
} from '@/lib/field-job-snapshot';
import type { CobranzaRow } from '@/lib/cobranza';

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

  it('picks top N cobranza rows preserving urgency sort length', () => {
    const now = new Date('2026-08-20T12:00:00.000Z');
    const rows: CobranzaRow[] = [
      {
        id: '1',
        client_name: 'A',
        client_tel: null,
        ticket_date: new Date('2026-08-01'),
        created_at: now,
        total: 100,
        paid: 0,
        finished: true,
        company_id: 1,
        balanceDue: 100,
        paymentStatus: 'pending',
        daysOutstanding: 19,
        agingBucket: '15-30',
      },
      {
        id: '2',
        client_name: 'B',
        client_tel: null,
        ticket_date: new Date('2026-08-10'),
        created_at: now,
        total: 50,
        paid: 10,
        finished: true,
        company_id: 1,
        balanceDue: 40,
        paymentStatus: 'partial',
        daysOutstanding: 10,
        agingBucket: '0-14',
      },
    ];
    const picked = pickHoyCobranzaRows(rows, 1);
    expect(picked).toHaveLength(1);
    expect(picked[0]?.id).toBe('1');
  });
});
