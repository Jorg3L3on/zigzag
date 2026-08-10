import {
  buildTicketDraftStorageKey,
  clearTicketFormDraft,
  readTicketFormDraft,
  sanitizeTicketFormDraft,
  writeTicketFormDraft,
} from '@/lib/ticket-form-drafts';

describe('ticket form drafts', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('keys drafts by route, ticket id, and company context', () => {
    expect(
      buildTicketDraftStorageKey({
        route: '/tickets/42/edit?step=create',
        ticketId: 42,
        companyId: 7,
      }),
    ).toBe('zigzag:ticket-draft:v1:/tickets/42/edit:ticket:42:company:7');
  });

  it('sanitizes unknown fields before persisting', () => {
    const draft = sanitizeTicketFormDraft({
      client_id: 10,
      client_name: 'Cliente Alfa',
      client_tel: '5551234567',
      password: 'secret',
      token: 'secret',
      ticket_date: new Date('2026-08-10T05:00:00.000Z'),
    });

    expect(draft).toEqual({
      client_id: 10,
      client_name: 'Cliente Alfa',
      client_tel: '5551234567',
      ticket_date: '2026-08-10T05:00:00.000Z',
    });
    expect(draft).not.toHaveProperty('password');
    expect(draft).not.toHaveProperty('token');
  });

  it('round-trips allowed draft fields through localStorage', () => {
    const key = buildTicketDraftStorageKey({
      route: '/tickets/create',
      companyId: 1,
    });

    writeTicketFormDraft(key, {
      client_id: 10,
      client_name: 'Cliente Alfa',
      client_tel: '5551234567',
      email: 'alfa@example.com',
      ticket_date: new Date('2026-08-10T05:00:00.000Z'),
      password: 'secret',
    });

    expect(readTicketFormDraft(key)).toEqual(
      expect.objectContaining({
        client_id: 10,
        client_name: 'Cliente Alfa',
        client_tel: '5551234567',
        email: 'alfa@example.com',
        ticket_date: '2026-08-10T05:00:00.000Z',
      }),
    );

    clearTicketFormDraft(key);
    expect(readTicketFormDraft(key)).toBeNull();
  });
});
