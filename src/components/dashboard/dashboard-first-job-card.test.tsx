import { render, screen } from '@testing-library/react';
import { DashboardFirstJobCard } from '@/components/dashboard/dashboard-first-job-card';

let canWrite = true;
jest.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({ can: () => canWrite }),
}));

describe('DashboardFirstJobCard (ZIG-I18-12)', () => {
  beforeEach(() => {
    canWrite = true;
  });

  it('leads an empty company to Anotar trabajo', () => {
    render(<DashboardFirstJobCard totalTickets={0} />);
    expect(screen.getByRole('heading', { name: 'Anota tu primer trabajo' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Anotar trabajo' })).toHaveAttribute('href', '/anotar');
  });

  it('disappears after the first ticket, while loading, or without permission', () => {
    const { rerender } = render(<DashboardFirstJobCard totalTickets={1} />);
    expect(screen.queryByTestId('dashboard-first-job')).not.toBeInTheDocument();
    rerender(<DashboardFirstJobCard totalTickets={null} />);
    expect(screen.queryByTestId('dashboard-first-job')).not.toBeInTheDocument();
    canWrite = false;
    rerender(<DashboardFirstJobCard totalTickets={0} />);
    expect(screen.queryByTestId('dashboard-first-job')).not.toBeInTheDocument();
  });
});
