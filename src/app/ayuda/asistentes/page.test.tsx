import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AyudaAsistentesPage from '@/app/ayuda/asistentes/page';
import { cursorMcpConfig, getMcpClient } from '@/lib/mcp-clients';
import type { McpCatalog } from '@/lib/mcp/registry-catalog';

jest.mock('next/headers', () => ({
  headers: async () => new Headers({ host: 'zigzag.example', 'x-forwarded-proto': 'https' }),
}));

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));

const STUB_CATALOG: McpCatalog = {
  tools: [
    { name: 'whoami', title: 'Quién soy', description: 'Llámala primero.', readOnly: true, destructive: false },
    { name: 'create_ticket', title: 'Crear ticket', description: 'Crea un ticket.', readOnly: false, destructive: false },
  ],
  prompts: [{ name: 'cobranza_de_hoy', title: 'Cobranza', description: 'Recordatorios.' }],
};

const mockReadCatalog = jest.fn(async (): Promise<McpCatalog> => STUB_CATALOG);
jest.mock('@/lib/mcp/registry-catalog', () => ({
  readMcpCatalog: () => mockReadCatalog(),
}));

const URL = 'https://zigzag.example/api/mcp';

describe('/ayuda/asistentes', () => {
  beforeEach(() => {
    mockReadCatalog.mockImplementation(async () => STUB_CATALOG);
  });

  it('renders the three numbered steps, examples, limits and the closed setup details', async () => {
    render(await AyudaAsistentesPage());

    expect(screen.getByRole('heading', { level: 1, name: 'Conecta tu asistente' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '01 Copia esta dirección' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '02 Pégala en tu asistente' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '03 Elige qué puede hacer' })).toBeInTheDocument();
    expect(screen.getByTestId('assistant-mcp-url')).toHaveTextContent(URL);

    const scopes = screen.getByTestId('docs-scopes');
    for (const text of ['Leer', 'Escribir', 'Cobros', 'read', 'write', 'payments', 'Sin reembolsos ni borrado de pagos']) {
      expect(scopes).toHaveTextContent(text);
    }
    expect(screen.getByText('¿A quién le tengo que cobrar hoy?')).toBeInTheDocument();

    const limits = screen.getByTestId('assistant-limits');
    for (const fact of ['sin empresas no ve nada', '120 llamadas por minuto', '24 horas', 'hasta un año', '365 días', 'contraseña', '90 días']) {
      expect(limits).toHaveTextContent(fact);
    }

    const details = screen.getByText('Para quien lo configura: herramientas').closest('details');
    expect(details).not.toHaveAttribute('open');
    expect(details).toHaveTextContent('Streamable HTTP');
    const table = screen.getByTestId('docs-tools-table');
    expect(within(table).getByText('whoami')).toBeInTheDocument();
    expect(within(table).getByText('Escritura')).toBeInTheDocument();
    expect(within(screen.getByTestId('docs-prompts-table')).getByText('cobranza_de_hoy')).toBeInTheDocument();
  });

  it('shows each assistant its own steps from mcp-clients, and the config block only for Cursor', async () => {
    render(await AyudaAsistentesPage());

    const tabs = within(screen.getByRole('group', { name: 'Asistente' })).getAllByRole('button');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['ChatGPT', 'Claude', 'Grok', 'Cursor']);
    expect(tabs[0]).toHaveAttribute('aria-pressed', 'true');

    for (const id of ['chatgpt', 'claude', 'grok', 'cursor'] as const) {
      const client = getMcpClient(id);
      fireEvent.click(screen.getByRole('button', { name: client.name }));
      expect(screen.getByRole('button', { name: client.name })).toHaveAttribute('aria-pressed', 'true');
      const card = screen.getByTestId(`docs-client-${id}`);
      expect(card).toHaveTextContent(client.authLabel);
      const steps = within(card).getAllByRole('listitem');
      expect(steps).toHaveLength(client.steps.length);
      client.steps.forEach((step, index) => expect(steps[index]).toHaveTextContent(step));
      if (id === 'cursor') {
        expect(screen.getByTestId('assistant-cursor-config').textContent).toBe(cursorMcpConfig(URL));
      } else {
        expect(screen.queryByTestId('assistant-cursor-config')).not.toBeInTheDocument();
      }
    }
  });

  it('Copiar writes the connector URL to the clipboard and turns into Copiada', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(await AyudaAsistentesPage());

    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));

    expect(writeText).toHaveBeenCalledWith(URL);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copiada' })).toBeInTheDocument());
  });
});
