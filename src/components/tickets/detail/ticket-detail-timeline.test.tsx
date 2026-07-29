/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { TicketDetailTimeline } from '@/components/tickets/detail/ticket-detail-timeline';
import type { TicketAuditHistoryEntry } from '@/actions/tickets';

const buildEntries = (count: number): TicketAuditHistoryEntry[] =>
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    eventType: 'updated',
    createdAt: new Date(`2026-07-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`),
    actorName: `Actor ${index + 1}`,
    payload: { before: {}, after: {} },
  }));

describe('TicketDetailTimeline', () => {
  it('renders an empty state when there are no events', () => {
    render(<TicketDetailTimeline entries={[]} />);
    expect(
      screen.getByText('Aún no hay eventos registrados para este ticket.'),
    ).toBeInTheDocument();
  });

  it('caps the scroll viewport and loads more events on scroll', () => {
    const entries = buildEntries(12);
    render(<TicketDetailTimeline entries={entries} />);

    const region = screen.getByRole('region', {
      name: 'Historial de actividad del ticket',
    });
    expect(region).toHaveStyle({ maxHeight: 'calc(5 * 4.5rem)' });

    expect(screen.getByText('Actor 1')).toBeInTheDocument();
    expect(screen.getByText('Actor 5')).toBeInTheDocument();
    expect(screen.queryByText('Actor 6')).not.toBeInTheDocument();
    expect(screen.getByText('Desplaza para ver más eventos')).toBeInTheDocument();

    Object.defineProperty(region, 'scrollHeight', { configurable: true, value: 400 });
    Object.defineProperty(region, 'clientHeight', { configurable: true, value: 200 });
    Object.defineProperty(region, 'scrollTop', { configurable: true, value: 180 });

    fireEvent.scroll(region);

    expect(screen.getByText('Actor 6')).toBeInTheDocument();
    expect(screen.getByText('Actor 10')).toBeInTheDocument();
    expect(screen.queryByText('Actor 11')).not.toBeInTheDocument();
  });
});
