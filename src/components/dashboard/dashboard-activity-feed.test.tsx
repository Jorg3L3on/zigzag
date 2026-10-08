/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { DashboardActivityFeed } from '@/components/dashboard/dashboard-activity-feed';
import type { ActivityFeedItem } from '@/lib/activity-feed';

const mockFetch = jest.fn();

jest.mock('@/actions/dashboard-activity', () => ({
  fetchDashboardActivity: (input: unknown) => mockFetch(input),
}));

jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { company_id: 1, company_is_system: false } },
  }),
}));

jest.mock('@/contexts/company-context', () => ({
  useCompany: () => ({ selectedCompany: null }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const makeItems = (from: number, count: number): ActivityFeedItem[] =>
  Array.from({ length: count }, (_, index) => {
    const n = from + index;
    return {
      id: `e${n}`,
      eventIds: [n],
      icon: 'ticket',
      title: `Evento ${n}`,
      description: null,
      occurredAt: new Date(2026, 9, 8, 12, 0, 0).toISOString(),
      href: null,
      count: 1,
      actorName: null,
      resourceType: 'ticket',
      action: 'created',
    };
  });

const page = (from: number, count: number, nextCursor: number | null) => ({
  success: true,
  data: { items: makeItems(from, count), nextCursor },
});

const rowCount = () =>
  screen.getAllByText(/^Evento \d+$/).length;

describe('DashboardActivityFeed', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('shows 5 rows, then 10 more per Ver más, and hides the button at the end', async () => {
    mockFetch
      .mockResolvedValueOnce(page(1, 5, 105))
      .mockResolvedValueOnce(page(6, 10, 95))
      .mockResolvedValueOnce(page(16, 10, null));

    render(<DashboardActivityFeed />);

    await waitFor(() => expect(rowCount()).toBe(5));
    expect(mockFetch).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: 5, cursor: undefined }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ver más' }));
    await waitFor(() => expect(rowCount()).toBe(15));
    expect(mockFetch).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: 10, cursor: 105 }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ver más' }));
    await waitFor(() => expect(rowCount()).toBe(25));
    expect(mockFetch).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: 10, cursor: 95 }),
    );
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument();
  });

  it('shows no Ver más when the first page is everything', async () => {
    mockFetch.mockResolvedValueOnce(page(1, 3, null));

    render(<DashboardActivityFeed />);

    await waitFor(() => expect(rowCount()).toBe(3));
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument();
  });

  it('gives Ver más a 44px target', async () => {
    mockFetch.mockResolvedValueOnce(page(1, 5, 10));

    render(<DashboardActivityFeed />);

    const button = await screen.findByRole('button', { name: 'Ver más' });
    expect(button.className).toContain('min-h-11');
  });
});
