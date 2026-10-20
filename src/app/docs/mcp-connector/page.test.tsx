import { render, screen, within } from '@testing-library/react';
import McpConnectorDocsPage from '@/app/docs/mcp-connector/page';

jest.mock('next/headers', () => ({
  headers: async () => new Headers({ host: 'zigzag.example', 'x-forwarded-proto': 'https' }),
}));

jest.mock('@/lib/mcp/registry-catalog', () => ({
  readMcpCatalog: async () => ({
    tools: [
      { name: 'whoami', title: 'Quién soy', description: 'Llámala primero.', readOnly: true, destructive: false },
      { name: 'create_ticket', title: 'Crear ticket', description: 'Crea un ticket.', readOnly: false, destructive: false },
    ],
    prompts: [{ name: 'cobranza_de_hoy', title: 'Cobranza', description: 'Recordatorios.' }],
  }),
}));

describe('/docs/mcp-connector', () => {
  it('renders the URL, the four clients, the registry tools and the scopes', async () => {
    render(await McpConnectorDocsPage());

    expect(screen.getByRole('heading', { level: 1, name: 'Conector MCP' })).toBeInTheDocument();
    expect(screen.getByText('https://zigzag.example/api/mcp')).toBeInTheDocument();
    for (const id of ['chatgpt', 'grok', 'claude', 'cursor']) {
      expect(screen.getByTestId(`docs-client-${id}`)).toBeInTheDocument();
    }
    const table = screen.getByTestId('docs-tools-table');
    expect(within(table).getByText('whoami')).toBeInTheDocument();
    expect(within(table).getByText('Escritura')).toBeInTheDocument();
    expect(screen.getByTestId('docs-scopes')).toHaveTextContent('read');
    expect(screen.getByTestId('docs-scopes')).toHaveTextContent('write');
    expect(screen.getByText('cobranza_de_hoy')).toBeInTheDocument();
  });
});
