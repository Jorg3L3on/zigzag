import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OperatorActivityPanel } from '@/components/operator-console/operator-activity-panel';

const mockUseCompany = jest.fn();

jest.mock('@/contexts/company-context', () => ({
  useCompany: () => mockUseCompany(),
}));

const sampleItem = {
  id: 1,
  occurred_at: '2026-07-25T12:00:00.000Z',
  actor_user_id: '2',
  actor_name: 'Carlos Díaz',
  resource_type: 'ticket',
  resource_id: '1004',
  action: 'generated',
  result: 'success',
  payload: { note: 'ok' },
  request_meta: { path: '/api/tickets/1004/invoice' },
};

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

  afterEach(() => {
    jest.useRealTimers();
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

  it('renders Spanish labels and actor names', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          items: [sampleItem],
          nextCursor: null,
        },
      }),
    })) as jest.Mock;

    render(<OperatorActivityPanel />);

    await waitFor(() => {
      expect(screen.getAllByText('Carlos Díaz').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Generación').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Éxito').length).toBeGreaterThan(0);
    expect(screen.queryByText(/^2$/)).not.toBeInTheDocument();
  });

  it('requests incidents_only from the server when toggled', async () => {
    const user = userEvent.setup();
    render(<OperatorActivityPanel />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    await user.click(screen.getByRole('button', { name: 'Solo incidentes' }));

    await waitFor(() => {
      const urls = (global.fetch as jest.Mock).mock.calls.map(
        (call) => call[0] as string,
      );
      expect(
        urls.some((url) => url.includes('incidents_only=1')),
      ).toBe(true);
    });
  });

  it('debounces search into the audit API query', async () => {
    jest.useFakeTimers();
    render(<OperatorActivityPanel />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const search = screen.getByRole('textbox', { name: 'Buscar' });
    fireEvent.change(search, { target: { value: 'factura' } });
    await jest.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      const urls = (global.fetch as jest.Mock).mock.calls.map(
        (call) => call[0] as string,
      );
      expect(urls.some((url) => url.includes('search=factura'))).toBe(true);
    });

    jest.useRealTimers();
  });

  it('expands payload details when a row is activated', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          items: [sampleItem],
          nextCursor: null,
        },
      }),
    })) as jest.Mock;

    render(<OperatorActivityPanel />);

    await waitFor(() => {
      expect(screen.getAllByText('Carlos Díaz').length).toBeGreaterThan(0);
    });

    const detailButtons = await screen.findAllByRole('button', {
      name: /Ver detalle del evento 1/i,
    });
    fireEvent.click(detailButtons[0]);

    expect(detailButtons[0]).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByText('Carga útil').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/"note": "ok"/).length).toBeGreaterThan(0);
  });
});
