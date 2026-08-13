import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuditList } from '@/components/audit/audit-list';

const replace = jest.fn();

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

  it('shows labeled date filters without a resource id filter on desktop', async () => {
    render(<AuditList />);

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

  it('shows Todos los estatus and clears filters', async () => {
    render(<AuditList />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Limpiar todos los filtros' }),
    );

    expect(await screen.findByText('Todos los estatus')).toBeInTheDocument();

    await waitFor(() => {
      const lastReplaceCall = replace.mock.calls.at(-1)?.[0] as string;
      expect(lastReplaceCall).toBe('/audit');
    });
  });

  it('renders investigation presets and export control', async () => {
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
      screen.getByRole('button', { name: 'Exportar auditoría a CSV' }),
    ).toBeInTheDocument();
  });

  it('shows IP metadata when expanding an event with request_meta', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          items: [
            {
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
            },
          ],
          nextCursor: null,
        },
      }),
    })) as jest.Mock;

    render(<AuditList />);

    expect(
      await screen.findAllByText(/Inicio de sesión fallido/i),
    ).not.toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'Ver' }));

    expect(await screen.findAllByText('IP: 203.0.113.10')).not.toHaveLength(0);
    expect(
      screen.getAllByText(/UA: Mozilla\/5\.0 TestAgent/),
    ).not.toHaveLength(0);
    expect(
      screen.getAllByText('Request ID: req-test-1234'),
    ).not.toHaveLength(0);
  });
});
