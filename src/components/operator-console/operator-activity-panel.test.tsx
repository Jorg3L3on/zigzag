import { render, waitFor } from '@testing-library/react';
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
});
