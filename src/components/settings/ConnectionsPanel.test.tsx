import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ConnectionsPanel } from '@/components/settings/ConnectionsPanel';
import { SidebarProvider } from '@/components/ui/sidebar';

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const noWhoami = { chatgpt: null, grok: null, claude: null, cursor: null };

// The app shell provides the sidebar the mobile app bar talks to.
const renderPanel = () =>
  render(
    <SidebarProvider>
      <ConnectionsPanel
        mcpUrl="https://zigzag.test/api/mcp"
        companies={[{ id: 4, name: 'ClimaTotal Demo' }]}
        whoami={noWhoami}
      />
    </SidebarProvider>,
  );

const key = (id: number, scopes: string[]) => ({
  id,
  name: `Llave ${id}`,
  key_prefix: `zigzag_k${id}`,
  scopes,
  allowed_company_ids: [4],
  last_used_at: null,
  expires_at: null,
  revoked_at: null,
  created_at: '2026-10-01T00:00:00.000Z',
  last_activity: null,
});

const grant = (id: number, scopes: string[]) => ({
  id,
  client_id: `client-${id}`,
  client_name: `Cliente ${id}`,
  scopes,
  allowed_company_ids: [4],
  last_used_at: null,
  expires_at: null,
  revoked_at: null,
  created_at: '2026-10-01T00:00:00.000Z',
  last_activity: null,
});

describe('ConnectionsPanel payments scope (ZIG-I23-7)', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return { ok: true, json: async () => ({ ...key(9, ['read']), token: 'zigzag_new' }) };
      }
      if (url === '/api/account/api-keys') {
        return { ok: true, json: async () => [key(1, ['read', 'write', 'payments']), key(2, ['read'])] };
      }
      return { ok: true, json: async () => [grant(3, ['read', 'payments']), grant(5, ['read', 'write'])] };
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('shows the Pagos badge only on connections that hold the scope', async () => {
    renderPanel();

    const keys = await screen.findAllByTestId('api-key-card');
    expect(within(keys[0]).getByTestId('payments-badge')).toHaveTextContent('Pagos');
    expect(within(keys[1]).queryByTestId('payments-badge')).toBeNull();

    const grants = screen.getAllByTestId('oauth-grant-card');
    expect(within(grants[0]).getByTestId('payments-badge')).toBeInTheDocument();
    expect(within(grants[1]).queryByTestId('payments-badge')).toBeNull();
  });

  it('Nueva llave starts with payments off and only sends it when ticked', async () => {
    renderPanel();
    await screen.findAllByTestId('api-key-card');

    const payments = screen.getByRole('checkbox', {
      name: 'Registrar pagos (el agente podrá marcar cobros)',
    });
    expect(payments).not.toBeChecked();

    const postedScopes = () => {
      const call = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST').at(-1);
      return JSON.parse(call![1].body).scopes;
    };

    fireEvent.change(screen.getByLabelText('Nombre de la conexión'), { target: { value: 'Agente' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear llave' }));
    await waitFor(() => expect(postedScopes()).toEqual(['read']));

    fireEvent.change(screen.getByLabelText('Nombre de la conexión'), { target: { value: 'Cobrador' } });
    fireEvent.click(payments);
    fireEvent.click(screen.getByRole('button', { name: 'Crear llave' }));
    await waitFor(() => expect(postedScopes()).toEqual(['read', 'payments']));
  });
});
