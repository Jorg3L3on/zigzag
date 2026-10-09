/**
 * @jest-environment jsdom
 */
import {
  buildTicketComposerDraftKey,
  clearTicketComposerDraft,
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
