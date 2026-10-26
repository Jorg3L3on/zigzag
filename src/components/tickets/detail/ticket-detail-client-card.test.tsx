/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { TicketDetailClientCard } from '@/components/tickets/detail/ticket-detail-client-card';

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
