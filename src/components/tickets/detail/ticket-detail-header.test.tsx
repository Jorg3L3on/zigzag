/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { TicketDetailHeader } from '@/components/tickets/detail/ticket-detail-header';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const base = {
  ticketId: 1123,
  clientName: 'Corporativo Inmobiliario Torres del Caribe S.A. de C.V. Torre B Piso 14',
  clientId: 9,
  finished: true,
  total: 100,
  paid: 40,
  ticketDate: new Date('2026-10-10T12:00:00Z'),
  creatorName: 'Jorge Climas',
};

describe('TicketDetailHeader (ZIG-I13-4)', () => {
  it('titles with the client (wrapping) and shows Desde presupuesto #N for a converted ticket', () => {
    render(<TicketDetailHeader {...base} fromPresupuestoId="1122" />);

    const title = screen.getByRole('heading', { level: 1 });
    expect(title).toHaveTextContent('Corporativo Inmobiliario Torres del Caribe');
    expect(title.className).toContain('[overflow-wrap:anywhere]');
    expect(screen.getByText(/Jorge Climas/)).toBeInTheDocument();
    expect(screen.getByTestId('ticket-from-presupuesto')).toHaveAttribute('href', '/presupuestos/1122');
    expect(screen.getByTestId('ticket-from-presupuesto')).toHaveTextContent('Desde presupuesto #1122');
  });

  it('has no origin link for a ticket that was not converted', () => {
    render(<TicketDetailHeader {...base} />);
    expect(screen.queryByTestId('ticket-from-presupuesto')).toBeNull();
  });

  it('keeps Creado / Actualizado out of the header', () => {
    render(<TicketDetailHeader {...base} />);
    expect(screen.queryByText('Creado')).toBeNull();
    expect(screen.queryByText('Actualizado')).toBeNull();
  });

  it('puts the actions beside the title from lg and a 48rem page, under the meta below (ZIG-I37-4)', () => {
    render(<TicketDetailHeader {...base} actions={<button type="button">PDF</button>} />);

    const header = screen.getByTestId('ticket-detail-header');
    expect(header).toHaveClass('flex-col', 'lg:@min-[48rem]:flex-row', 'lg:@min-[48rem]:items-start');
    // display: contents, so an empty cluster leaves no column and no gap.
    const slot = screen.getByRole('button', { name: 'PDF' }).parentElement;
    expect(slot).toHaveClass('hidden', 'md:contents');
    expect(screen.getByRole('heading', { level: 1 }).closest('div.lg\\:\\@min-\\[48rem\\]\\:flex-1')).not.toBeNull();
  });
});
