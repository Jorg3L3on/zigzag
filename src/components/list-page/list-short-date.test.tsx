import { render, screen } from '@testing-library/react';

import { ListShortDate } from '@/components/list-filter/list-desktop';

describe('ListShortDate', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    // 2026-10-26 18:00 in Mexico City.
    jest.setSystemTime(new Date('2026-10-27T00:00:00Z'));
  });
  afterAll(() => jest.useRealTimers());

  it('drops the year in the current year', () => {
    render(<ListShortDate date={new Date('2026-10-08T18:00:00Z')} />);
    expect(screen.getByText('8 oct')).toBeInTheDocument();
  });

  it('keeps the year for other years', () => {
    render(<ListShortDate date="2025-03-02T18:00:00Z" />);
    expect(screen.getByText('2 mar 2025')).toBeInTheDocument();
  });

  it('reads the company calendar: 20:00 in Mexico City is still that day', () => {
    // 2026-10-09 02:00 UTC is 2026-10-08 20:00 in America/Mexico_City.
    render(<ListShortDate date={new Date('2026-10-09T02:00:00Z')} />);
    const label = screen.getByText('8 oct');
    expect(label).toHaveAttribute('title', expect.stringContaining('8 de octubre de 2026'));
  });

  it('reads the year in the company calendar too', () => {
    // New Year's Eve at 20:00 in Mexico City is already 2027 in UTC.
    render(<ListShortDate date={new Date('2027-01-01T02:00:00Z')} />);
    expect(screen.getByText('31 dic')).toBeInTheDocument();
  });

  it('shows a dash without a date', () => {
    render(<ListShortDate date={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
