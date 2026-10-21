/** @jest-environment node */
import { readMcpCatalog } from '@/lib/mcp/registry-catalog';

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));

describe('readMcpCatalog', () => {
  it('lists every registered tool with its title, description and kind', async () => {
    const { tools, prompts } = await readMcpCatalog();
    const names = tools.map((tool) => tool.name);

    expect(names).toEqual(
      expect.arrayContaining([
        'whoami',
        'list_companies',
        'list_documents',
        'get_document',
        'search',
        'fetch',
        'create_ticket',
      ]),
    );
    expect(new Set(names).size).toBe(names.length);
    for (const tool of tools) {
      expect(tool.title).not.toBe('');
      expect(tool.description).not.toBe('');
    }
    expect(tools.find((tool) => tool.name === 'whoami')?.readOnly).toBe(true);
    expect(tools.find((tool) => tool.name === 'create_ticket')?.readOnly).toBe(false);
    expect(prompts.map((prompt) => prompt.name)).toEqual(
      expect.arrayContaining(['cobranza_de_hoy', 'ticket_desde_mensaje', 'resumen_cliente']),
    );
  });
});
