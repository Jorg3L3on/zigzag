/**
 * @jest-environment jsdom
 */
import {
  buildTicketComposerDraftKey,
  clearTicketComposerDraft,
  draftLineToServiceLineInput,
  readTicketComposerDraft,
  sanitizeTicketComposerDraft,
  writeTicketComposerDraft,
} from '@/lib/ticket-composer-draft';

const key = buildTicketComposerDraftKey(10);

const line = {
  key: 'l1',
  service_id: 7,
  service_name: 'Mantenimiento',
  quantity: 3,
  price: 4200,
};

describe('ticket composer draft', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('round-trips client, date, notes and lines', () => {
    writeTicketComposerDraft(key, {
      client_id: 5,
      client_label: 'Cliente Demo · 555',
      ticket_date: '2026-10-08T12:00:00.000Z',
      work_notes: 'Revisar compresor',
      lines: [line],
    });

    const draft = readTicketComposerDraft(key);
    expect(draft).toMatchObject({
      client_id: 5,
      client_label: 'Cliente Demo · 555',
      ticket_date: '2026-10-08T12:00:00.000Z',
      work_notes: 'Revisar compresor',
      lines: [line],
    });
    expect(typeof draft?.updatedAt).toBe('string');
  });

  it('is scoped per company', () => {
    writeTicketComposerDraft(key, { lines: [line] });
    expect(readTicketComposerDraft(buildTicketComposerDraftKey(11))).toBeNull();
  });

  it('removes the stored draft when it becomes empty', () => {
    writeTicketComposerDraft(key, { lines: [line] });
    writeTicketComposerDraft(key, { lines: [] });
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it('drops malformed lines and fields', () => {
    const draft = sanitizeTicketComposerDraft({
      client_id: -1,
      ticket_date: 'not-a-date',
      lines: [
        line,
        { ...line, key: 'l2', quantity: 0 },
        { ...line, key: 'l3', price: -5 },
        { ...line, key: 'l4', service_id: 'x' },
        null,
      ],
    });
    expect(draft).toEqual({ lines: [line] });
  });

  it('round-trips inline lines and reads pre-ZIG-I5 lines as catalog (ZIG-I5)', () => {
    const inline = {
      key: 'l2',
      kind: 'custom' as const,
      service_id: null,
      service_name: 'Cambio de capacitor',
      description: '35 µF',
      save_to_catalog: true,
      quantity: 1,
      price: 850,
    };
    writeTicketComposerDraft(key, { lines: [line, inline] });
    const restored = readTicketComposerDraft(key);
    expect(restored?.lines).toEqual([line, inline]);
    expect(restored?.lines.map(draftLineToServiceLineInput)).toEqual([
      { service_id: 7, quantity: 3, price: 4200 },
      {
        kind: 'custom',
        name: 'Cambio de capacitor',
        description: '35 µF',
        save_to_catalog: true,
        quantity: 1,
        price: 850,
      },
    ]);
  });

  it('drops inline lines without a name', () => {
    const draft = sanitizeTicketComposerDraft({
      lines: [
        { key: 'a', kind: 'custom', service_id: null, service_name: '  ', quantity: 1, price: 1 },
        { key: 'b', kind: 'custom', service_name: 'Visita', quantity: 1, price: 300 },
      ],
    });
    expect(draft.lines).toEqual([
      {
        key: 'b',
        kind: 'custom',
        service_id: null,
        service_name: 'Visita',
        save_to_catalog: false,
        quantity: 1,
        price: 300,
      },
    ]);
  });

  it('ignores corrupt JSON', () => {
    window.localStorage.setItem(key, '{oops');
    expect(readTicketComposerDraft(key)).toBeNull();
  });

  it('clears the draft', () => {
    writeTicketComposerDraft(key, { lines: [line] });
    clearTicketComposerDraft(key);
    expect(readTicketComposerDraft(key)).toBeNull();
  });
});
