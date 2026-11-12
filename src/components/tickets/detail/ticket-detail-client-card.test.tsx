/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import {
  describeClientDocuments,
  TicketDetailClientCard,
} from '@/components/tickets/detail/ticket-detail-client-card';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const base = {
  client: { id: 5, name: 'Residencial Las Palmas', phone: '9981000002' },
  clientName: 'Residencial Las Palmas',
  clientTel: '9981000002',
  clientEmail: null,
  ticketCount: 3,
  ticketId: 61,
  folio: 'R-0061',
  total: 5120,
  paid: 1000,
  companyName: 'ClimaTotal Demo',
};

const whatsAppText = () =>
  decodeURIComponent(screen.getByTestId('ticket-client-whatsapp').getAttribute('href') ?? '');

describe('TicketDetailClientCard WhatsApp (PR #610 review)', () => {
  it('signs the recibo with the company once the ticket is finished', () => {
    render(<TicketDetailClientCard {...base} finished />);
    const text = whatsAppText();
    expect(text).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    expect(text).toContain('ClimaTotal Demo');
    expect(text).not.toContain('ZigZag');
  });

  it('opens a plain greeting while the ticket is En proceso, with no recibo yet', () => {
    render(<TicketDetailClientCard {...base} finished={false} />);
    const text = whatsAppText();
    expect(text).toContain('Hola, te escribe ClimaTotal Demo.');
    expect(text).not.toMatch(/recibo/i);
  });
});

describe('TicketDetailClientCard layout (canvas)', () => {
  it('prints the phone in groups, an em dash without email and the other ticket that owes', () => {
    render(
      <TicketDetailClientCard
        {...base}
        finished={false}
        openBalances={[{ id: '60', folio: 'R-0060', balance: 421582.39 }]}
      />,
    );
    expect(screen.getByTestId('ticket-client-phone')).toHaveTextContent('998 100 0002');
    expect(screen.getByText('Correo').nextElementSibling).toHaveTextContent('—');
    expect(screen.getByTestId('ticket-client-documents')).toHaveTextContent(
      '3 tickets · R-0060 con saldo $421,582.39',
    );
  });

  it('says since when the client is, when nothing else is owed', () => {
    expect(
      describeClientDocuments({ ticketCount: 2, clientSince: new Date('2026-10-10T12:00:00Z') }),
    ).toBe('2 tickets · cliente desde octubre de 2026');
    expect(
      describeClientDocuments({
        ticketCount: 5,
        openBalances: [
          { folio: 'R-0058', balance: 1000 },
          { folio: 'R-0050', balance: 552.5 },
        ],
      }),
    ).toBe('5 tickets · 2 con saldo $1,552.50');
  });
});
