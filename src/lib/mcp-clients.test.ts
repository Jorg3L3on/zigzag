import {
  classifyOAuthClient,
  clientNamedIn,
  cursorMcpConfig,
  MCP_CLIENTS,
} from '@/lib/mcp-clients';

describe('MCP client catalog', () => {
  it('covers the four supported clients with 2–4 steps each', () => {
    expect(MCP_CLIENTS.map((client) => client.id)).toEqual(['chatgpt', 'grok', 'claude', 'cursor']);
    for (const client of MCP_CLIENTS) {
      expect(client.steps.length).toBeGreaterThanOrEqual(2);
      expect(client.steps.length).toBeLessThanOrEqual(4);
    }
  });

  it('finds the vendor a client_name borrows', () => {
    expect(clientNamedIn('Claude')?.id).toBe('claude');
    expect(clientNamedIn('x.AI Grok')?.id).toBe('grok');
    expect(clientNamedIn('Mi agente')).toBeNull();
  });

  it('classifies CIMD clients by host and DCR clients by name plus vendor redirects', () => {
    expect(
      classifyOAuthClient({
        client_id: 'https://chatgpt.com/oauth/client.json',
        client_name: 'ChatGPT',
        redirect_uris: [],
      }),
    ).toBe('chatgpt');
    expect(
      classifyOAuthClient({
        client_id: 'a1b2',
        client_name: 'Claude',
        redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
      }),
    ).toBe('claude');
    expect(
      classifyOAuthClient({
        client_id: 'a1b2',
        client_name: 'Claude',
        redirect_uris: ['https://evil.example.net/cb'],
      }),
    ).toBeNull();
    expect(
      classifyOAuthClient({
        client_id: 'a1b2',
        client_name: 'Jest flow',
        redirect_uris: ['https://chatgpt.com/connector_platform_oauth_redirect'],
      }),
    ).toBeNull();
  });

  it('builds the Cursor mcp.json with a bearer header', () => {
    expect(JSON.parse(cursorMcpConfig('https://z.example/api/mcp'))).toEqual({
      mcpServers: {
        zigzag: {
          url: 'https://z.example/api/mcp',
          headers: { Authorization: 'Bearer zigzag_…' },
        },
      },
    });
  });
});
