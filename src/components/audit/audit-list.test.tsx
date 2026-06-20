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
      'search=denied&target_company_id=2&actor_user_id=7&resource_type=ticket&resource_id=42&action=updated&result=denied&from=2026-05-01&to=2026-05-31',
    ),
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
    expect(params.get('resource_id')).toBe('42');
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
    expect(lastReplaceCall).toContain('resource_id=42');
    expect(lastReplaceCall).toContain('action=updated');
    expect(lastReplaceCall).toContain('result=denied');
    expect(lastReplaceCall).toContain('from=2026-05-01');
    expect(lastReplaceCall).toContain('to=2026-05-31');
  });

  it('shows recoverable load errors', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        error: 'No se pudo cargar la auditoría',
        errorType: 'server',
      }),
    })) as jest.Mock;

    render(<AuditList />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ocurrió un error del servidor',
    );

    await userEvent.click(screen.getByRole('button', { name: /Reintentar/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
