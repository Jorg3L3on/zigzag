import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OperatorActivityPanel } from '@/components/operator-console/operator-activity-panel';

const mockUseCompany = jest.fn();

jest.mock('@/contexts/company-context', () => ({
  useCompany: () => mockUseCompany(),
}));

/** DesktopSwitch keeps one tree: the desktop one when the lg query matches. */
const mockViewport = (desktop: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: desktop && query.includes('min-width'),
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
};

const mockItems = (items: unknown[], nextCursor: number | null = null) => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      success: true,
      data: { items, nextCursor },
    }),
  })) as jest.Mock;
};

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
    mockViewport(false);
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
    mockViewport(true);
    mockItems([sampleItem]);

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

    const search = screen.getByRole('textbox', {
      name: 'Buscar actividad de auditoría',
    });
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

  it('expands payload details from the phone card button', async () => {
    mockItems([sampleItem]);

    render(<OperatorActivityPanel />);

    const detailButton = await screen.findByRole('button', {
      name: /Ver detalle del evento 1/i,
    });
    fireEvent.click(detailButton);

    expect(detailButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByText('Carga útil').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/"note": "ok"/).length).toBeGreaterThan(0);
  });

  describe('desktop (ZIG-I33-8)', () => {
    beforeEach(() => {
      mockViewport(true);
    });

    it('opens the detail from the row by click and keyboard, with no detail button', async () => {
      mockItems([sampleItem]);
      render(<OperatorActivityPanel />);

      const table = await screen.findByRole('table', { name: 'Actividad reciente' });
      const row = within(table).getByTestId('operator-activity-row');
      expect(
        within(table).queryByRole('button', { name: /Ver detalle del evento/i }),
      ).not.toBeInTheDocument();

      fireEvent.click(row);
      // aria-expanded is not allowed on a table row (axe aria-conditional-attr); the open row is selected.
      expect(row).toHaveAttribute('data-state', 'selected');
      expect(screen.getByText('Carga útil')).toBeInTheDocument();

      fireEvent.keyDown(row, { key: 'Enter' });
      expect(row).not.toHaveAttribute('data-state');
      expect(screen.queryByText('Carga útil')).not.toBeInTheDocument();
    });

    it('sorts from the column header and shows the result as a pill', async () => {
      mockItems([sampleItem]);
      render(<OperatorActivityPanel />);

      const table = await screen.findByRole('table', { name: 'Actividad reciente' });
      const dateHeader = within(table).getByRole('columnheader', { name: /Fecha/ });
      const actorHeader = within(table).getByRole('columnheader', { name: /Actor/ });
      expect(dateHeader).toHaveAttribute('aria-sort', 'descending');
      fireEvent.click(within(actorHeader).getByRole('button', { name: /Actor/ }));
      expect(actorHeader).toHaveAttribute('aria-sort', 'ascending');
      expect(dateHeader).toHaveAttribute('aria-sort', 'none');

      expect(within(table).getByText('Éxito')).toHaveAttribute('data-tone', 'emerald');
    });

    it('uses pill selects and loads more from the card footer', async () => {
      mockItems([sampleItem], 1);
      render(<OperatorActivityPanel />);

      await screen.findByRole('table', { name: 'Actividad reciente' });
      expect(
        screen.getByRole('combobox', { name: 'Filtrar por tipo de recurso' }),
      ).toHaveTextContent('Todos los recursos');
      expect(screen.getByRole('combobox', { name: 'Filtrar por resultado' })).toHaveTextContent(
        'Todos los resultados',
      );
      expect(screen.getByTestId('list-footer')).toHaveTextContent('1 evento cargado');

      fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
      await waitFor(() => {
        const urls = (global.fetch as jest.Mock).mock.calls.map((call) => call[0] as string);
        expect(urls.some((url) => url.includes('cursor=1'))).toBe(true);
      });
    });

    it('shows the standard error with Reintentar', async () => {
      global.fetch = jest.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({ success: false, error: 'Fallo' }),
      })) as jest.Mock;
      render(<OperatorActivityPanel />);

      expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar');
      expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    });
  });
});
