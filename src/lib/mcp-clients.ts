/**
 * The MCP clients ZigZag documents and supports: one entry per client with the
 * setup steps Conexiones and the public guide show, the auth path it uses, and
 * the vendor hosts its OAuth redirects live on. DCR uses those hosts to tell a
 * real "Claude" registration from one that only borrows the name, and
 * Conexiones uses the same rule to find each client's connections.
 */
export type McpClientId = 'chatgpt' | 'grok' | 'claude' | 'cursor';

export type McpClientAuth = 'oauth' | 'bearer';

export type McpClientInfo = {
  id: McpClientId;
  name: string;
  auth: McpClientAuth;
  /** One line on how it authenticates, for the card and the guide. */
  authLabel: string;
  /** 2–4 short steps; `{url}` is replaced by the connector URL. */
  steps: string[];
  /** Lowercase tokens a client_name of this vendor contains. */
  nameTokens: string[];
  /** Hosts (and their subdomains) that belong to the vendor. */
  officialHosts: string[];
};

export const MCP_CLIENTS: McpClientInfo[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    auth: 'oauth',
    authLabel: 'OAuth (inicia sesión en ZigZag y autoriza)',
    steps: [
      'En ChatGPT abre Ajustes → Conectores → Modo desarrollador y actívalo.',
      'Toca Crear, ponle nombre «ZigZag» y pega la URL del conector.',
      'Elige autenticación OAuth y guarda.',
      'ChatGPT abre ZigZag: inicia sesión, elige compañías y toca Autorizar.',
    ],
    nameTokens: ['chatgpt', 'openai'],
    officialHosts: ['chatgpt.com', 'chat.openai.com', 'openai.com'],
  },
  {
    id: 'grok',
    name: 'Grok',
    auth: 'oauth',
    authLabel: 'OAuth desde Grok (si Grok no lo completa, usa una llave zigzag_…)',
    steps: [
      'Abre grok.com/connectors y toca New Connector → Custom.',
      'Pega la URL del conector y guarda.',
      'Completa la autenticación que Grok te pida en ZigZag y toca Autorizar.',
    ],
    nameTokens: ['grok', 'xai'],
    officialHosts: ['grok.com', 'x.ai', 'x.com'],
  },
  {
    id: 'claude',
    name: 'Claude',
    auth: 'oauth',
    authLabel: 'OAuth (inicia sesión en ZigZag y autoriza)',
    steps: [
      'En claude.ai abre Settings → Connectors → Add custom connector.',
      'Pega la URL del conector y toca Add.',
      'Toca Connect: Claude abre ZigZag, inicia sesión y toca Autorizar.',
    ],
    nameTokens: ['claude', 'anthropic'],
    officialHosts: ['claude.ai', 'claude.com', 'anthropic.com'],
  },
  {
    id: 'cursor',
    name: 'Cursor',
    auth: 'bearer',
    authLabel: 'Llave de agente zigzag_… en el encabezado Authorization',
    steps: [
      'Crea abajo una Nueva llave de agente y cópiala.',
      'En Cursor abre Settings → MCP → Add new MCP server (o edita ~/.cursor/mcp.json).',
      'Pega la configuración de abajo con tu llave en lugar de zigzag_…',
    ],
    nameTokens: ['cursor'],
    officialHosts: ['cursor.com', 'cursor.sh'],
  },
];

export const getMcpClient = (id: McpClientId): McpClientInfo =>
  MCP_CLIENTS.find((client) => client.id === id)!;

/** The mcp.json Cursor needs; the key stays a placeholder until the person pastes theirs. */
export const cursorMcpConfig = (url: string, token = 'zigzag_…') =>
  JSON.stringify(
    {
      mcpServers: {
        zigzag: { url, headers: { Authorization: `Bearer ${token}` } },
      },
    },
    null,
    2,
  );

const normalizeName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

const hostOf = (value: string): string | null => {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
};

export const isOfficialHost = (client: McpClientInfo, url: string): boolean => {
  const host = hostOf(url);
  if (!host) return false;
  return client.officialHosts.some((official) => host === official || host.endsWith(`.${official}`));
};

/** The client whose name a client_name borrows, if any. */
export const clientNamedIn = (clientName: string | null | undefined): McpClientInfo | null => {
  if (!clientName) return null;
  const normalized = normalizeName(clientName);
  return MCP_CLIENTS.find((client) => client.nameTokens.some((token) => normalized.includes(token))) ?? null;
};

/**
 * Which known client an OAuth client row is. A CIMD client_id on a vendor host
 * counts; otherwise the name must match a vendor and every redirect URI must
 * live on that vendor's hosts (the code goes to the vendor, not to whoever
 * typed the name).
 */
export const classifyOAuthClient = (oauthClient: {
  client_id: string;
  client_name: string | null;
  redirect_uris: string[];
}): McpClientId | null => {
  const byClientIdHost = MCP_CLIENTS.find((client) => isOfficialHost(client, oauthClient.client_id));
  if (byClientIdHost && oauthClient.client_id.startsWith('https://')) return byClientIdHost.id;

  const named = clientNamedIn(oauthClient.client_name);
  if (!named || oauthClient.redirect_uris.length === 0) return null;
  return oauthClient.redirect_uris.every((uri) => isOfficialHost(named, uri)) ? named.id : null;
};
