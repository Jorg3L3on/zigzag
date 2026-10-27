import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuditList } from '@/components/audit/audit-list';

const replace = jest.fn();

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

const failedSignIn = {
  id: 1,
  occurred_at: '2026-08-10T09:00:00.000Z',
  actor_user_id: '7',
  actor_name: 'Chano',
  actor_company_id: 2,
  actor_company_name: 'Acme',
  target_company_id: 2,
  target_company_name: 'Acme',
  resource_type: 'auth',
  resource_id: 'user@example.com',
  action: 'sign_in_failed',
  result: 'failed',
  source: 'auth',
  payload: { email: 'user@example.com', reason: 'throttled' },
  request_meta: {
    ip: '203.0.113.10',
    userAgent: 'Mozilla/5.0 TestAgent',
    route: '/login',
    method: 'POST',
    requestId: 'req-test-1234',
  },
};

const mockEvents = (items: unknown[], nextCursor: number | null = null) => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      success: true,
      data: { items, nextCursor },
    }),
  })) as jest.Mock;
};

jest.mock('next/navigation', () => ({
  usePathname: () => '/audit',
  useRouter: () => ({
    replace,
  }),
  useSearchParams: () =>
    new URLSearchParams(
      'search=denied&target_company_id=2&actor_user_id=7&resource_type=ticket&action=updated&result=denied&from=2026-05-01&to=2026-05-31',
    ),
}));

jest.mock('@/actions/companies', () => ({
  getCompanies: jest.fn(async () => ({
    success: true,
    data: [{ id: 2, name: 'Acme' }],
  })),
}));

jest.mock('@/actions/users', () => ({
  getUsers: jest.fn(async () => ({
    success: true,
    data: [{ id: BigInt(7), name: 'Jorge', company_id: 2 }],
  })),
}));

describe('AuditList', () => {
  beforeEach(() => {
    mockViewport(false);
    replace.mockClear();
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          items: [],
          nextCursor: null,
        },
      }),
    })) as jest.Mock;
  });

  it('initializes filters from URL state and sends them to the audit API', async () => {
    render(<AuditList />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/audit/events?'),
      );
    });

    const requestedUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    const params = new URLSearchParams(requestedUrl.split('?')[1]);

    expect(params.get('search')).toBe('denied');
    expect(params.get('target_company_id')).toBe('2');
    expect(params.get('actor_user_id')).toBe('7');
    expect(params.get('resource_type')).toBe('ticket');
    expect(params.get('resource_id')).toBeNull();
    expect(params.get('action')).toBe('updated');
    expect(params.get('result')).toBe('denied');
    expect(params.get('from')).toBe('2026-05-01');
    expect(params.get('to')).toBe('2026-05-31');
  });

  it('writes active filters back to the URL', async () => {
    render(<AuditList />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalled();
    });

    const lastReplaceCall = replace.mock.calls.at(-1)?.[0] as string;
    expect(lastReplaceCall).toContain('search=denied');
    expect(lastReplaceCall).toContain('target_company_id=2');
    expect(lastReplaceCall).toContain('actor_user_id=7');
    expect(lastReplaceCall).toContain('resource_type=ticket');
    expect(lastReplaceCall).not.toContain('resource_id=');
    expect(lastReplaceCall).toContain('action=updated');
    expect(lastReplaceCall).toContain('result=denied');
    expect(lastReplaceCall).toContain('from=2026-05-01');
    expect(lastReplaceCall).toContain('to=2026-05-31');
  });

  it('shows labeled date filters without a resource id filter', async () => {
    render(<AuditList />);

    await userEvent.click(
      await screen.findByRole('button', { name: /Abrir filtros/i }),
    );

    expect(await screen.findByLabelText('Desde')).toBeInTheDocument();
    expect(screen.getByLabelText('Hasta')).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Filtrar por ID de recurso'),
    ).not.toBeInTheDocument();
  });

  it('shows a mobile Filtros trigger', async () => {
    render(<AuditList />);

    expect(
      await screen.findByRole('button', { name: /Abrir filtros/i }),
    ).toBeInTheDocument();
  });

  it('opens the mobile Filtros sheet with labeled controls and Listo', async () => {
    render(<AuditList />);

    await userEvent.click(
      await screen.findByRole('button', { name: /Abrir filtros/i }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Filtros' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Empresa, actor, recurso/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Listo' })).toBeInTheDocument();
  });

  it('shows Todos los estatus and clears filters', async () => {
    render(<AuditList />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Limpiar todos los filtros' }),
    );
    await userEvent.click(screen.getByRole('button', { name: /Abrir filtros/i }));

    expect(await screen.findByText('Todos los estatus')).toBeInTheDocument();

    await waitFor(() => {
      const lastReplaceCall = replace.mock.calls.at(-1)?.[0] as string;
      expect(lastReplaceCall).toBe('/audit');
    });
  });

  it('renders investigation presets without an export control', async () => {
    render(<AuditList />);

    expect(
      await screen.findByRole('group', { name: 'Presets de investigación' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hoy' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Últimos 7 días' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Solo denegados' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Exportar auditoría a CSV' }),
    ).not.toBeInTheDocument();
  });

  it('keeps the sheet Limpiar neutral, never red (f6ffafda)', async () => {
    render(<AuditList />);

    await userEvent.click(
      await screen.findByRole('button', { name: /Abrir filtros/i }),
    );

    const clear = await screen.findByRole('button', {
      name: 'Limpiar todos los filtros activos',
    });
    expect(clear.className).not.toMatch(/destructive/);
  });

  describe('desktop (ZIG-I33-8)', () => {
    beforeEach(() => {
      mockViewport(true);
    });

    it('opens the event from the row, with no Detalle column', async () => {
      mockEvents([failedSignIn]);
      render(<AuditList />);

      const table = await screen.findByRole('table', { name: 'Eventos de auditoría' });
      expect(
        within(table).queryByRole('columnheader', { name: 'Detalle' }),
      ).not.toBeInTheDocument();
      expect(within(table).queryByRole('button', { name: 'Ver' })).not.toBeInTheDocument();

      const row = within(table).getByTestId('audit-row');
      fireEvent.click(row);

      expect(row).toHaveAttribute('aria-expanded', 'true');
      expect(await screen.findByText('IP: 203.0.113.10')).toBeInTheDocument();
      expect(screen.getByText(/UA: Mozilla\/5\.0 TestAgent/)).toBeInTheDocument();
      expect(screen.getByText('Request ID: req-test-1234')).toBeInTheDocument();

      fireEvent.keyDown(row, { key: 'Enter' });
      expect(row).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('audit-row-detail')).not.toBeInTheDocument();
    });

    it('draws the result as a status pill', async () => {
      mockEvents([failedSignIn]);
      render(<AuditList />);

      const table = await screen.findByRole('table', { name: 'Eventos de auditoría' });
      expect(within(table).getByText('Fallido')).toHaveAttribute('data-tone', 'red');
    });

    it('tints a chosen preset like any selected filter', async () => {
      render(<AuditList />);

      const today = await screen.findByRole('button', { name: 'Hoy' });
      expect(today).toHaveAttribute('aria-pressed', 'false');
      expect(today.className).toMatch(/h-11/);
      expect(today.className).toMatch(/rounded-full/);

      await userEvent.click(today);

      expect(today).toHaveAttribute('aria-pressed', 'true');
      expect(today.className).toMatch(/bg-primary\/10/);
      expect(today.className).not.toMatch(/bg-primary(\s|$)/);
    });

    it('keeps the URL filters in pills and the date range', async () => {
      render(<AuditList />);

      expect(
        await screen.findByRole('combobox', { name: 'Filtrar por resultado' }),
      ).toHaveTextContent('Denegado');
      expect(
        screen.getByRole('combobox', { name: 'Filtrar por tipo de recurso' }).className,
      ).toMatch(/bg-primary\/10/);
      expect(
        screen.getByRole('button', { name: 'Filtrar por rango de fechas' }),
      ).toHaveTextContent('1 may 2026 — 31 may 2026');
      expect(
        screen.getByRole('button', { name: 'Limpiar todos los filtros' }),
      ).toBeInTheDocument();
    });

    it('counts the loaded events and loads more from the footer', async () => {
      mockEvents([failedSignIn], 1);
      render(<AuditList />);

      await screen.findByRole('table', { name: 'Eventos de auditoría' });
      expect(screen.getByTestId('list-footer')).toHaveTextContent('1 evento cargado');
      expect(screen.getByText(/· 1 evento cargado\./)).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
      await waitFor(() => {
        const urls = (global.fetch as jest.Mock).mock.calls.map((call) => call[0] as string);
        expect(urls.some((url) => url.includes('cursor=1'))).toBe(true);
      });
    });
  });
});
