import { render, screen, waitFor } from '@testing-library/react';
import { OperatorActivityPanel } from '@/components/operator-console/operator-activity-panel';

const mockUseCompany = jest.fn();

jest.mock('@/contexts/company-context', () => ({
  useCompany: () => mockUseCompany(),
}));

describe('OperatorActivityPanel', () => {
  beforeEach(() => {
    mockUseCompany.mockReturnValue({
      selectedCompany: { id: 42, name: 'Acme', is_system: false },
    });
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        data: { items: [], nextCursor: null },
      }),
    })) as jest.Mock;
  });

  it('scopes audit requests to the selected company id', async () => {
    render(<OperatorActivityPanel />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const requestedUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    const params = new URLSearchParams(requestedUrl.split('?')[1]);
    expect(params.get('target_company_id')).toBe('42');
  });

  it('renders actor names instead of raw user ids', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          items: [
            {
              id: 1,
              occurred_at: '2026-07-25T12:00:00.000Z',
              actor_user_id: '2',
              actor_name: 'Carlos Díaz',
              resource_type: 'ticket',
              resource_id: '1004',
              action: 'generated',
              result: 'success',
            },
          ],
          nextCursor: null,
        },
      }),
    })) as jest.Mock;

    render(<OperatorActivityPanel />);

    await waitFor(() => {
      expect(screen.getAllByText('Carlos Díaz').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/^2$/)).not.toBeInTheDocument();
  });
});
