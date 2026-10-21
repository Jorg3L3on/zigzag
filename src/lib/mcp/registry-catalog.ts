/**
 * What the MCP server actually exposes, read from the registry itself: the
 * public guide renders its tools and prompts tables from this, so they never
 * drift from `registerMcpTools` / `registerMcpPrompts`. It runs a real
 * McpServer over an in-memory transport and asks `tools/list` and
 * `prompts/list`, exactly as a client would; nothing touches the database.
 */
import { InMemoryTransport, McpServer } from '@modelcontextprotocol/server';
import { registerMcpPrompts } from '@/lib/mcp/prompts';
import { registerMcpTools } from '@/lib/mcp/register-tools';

export type McpToolDoc = {
  name: string;
  title: string;
  description: string;
  readOnly: boolean;
  destructive: boolean;
};

export type McpPromptDoc = {
  name: string;
  title: string;
  description: string;
};

export type McpCatalog = { tools: McpToolDoc[]; prompts: McpPromptDoc[] };

type RpcMessage = { id?: number; result?: Record<string, unknown>; error?: unknown };

type ListedTool = {
  name: string;
  title?: string;
  description?: string;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; title?: string };
};

type ListedPrompt = { name: string; title?: string; description?: string };

export async function readMcpCatalog(): Promise<McpCatalog> {
  const server = new McpServer(
    { name: 'zigzag', version: '2.0.0' },
    { capabilities: { tools: { listChanged: true }, prompts: { listChanged: false } } },
  );
  registerMcpTools(server);
  registerMcpPrompts(server);

  const [client, serverSide] = InMemoryTransport.createLinkedPair();
  const pending = new Map<number, (message: RpcMessage) => void>();
  let nextId = 1;
  client.onmessage = (message) => {
    const response = message as unknown as RpcMessage;
    if (response.id == null) return;
    pending.get(response.id)?.(response);
    pending.delete(response.id);
  };
  const rpc = (method: string, params: Record<string, unknown> = {}) =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, (response) =>
        response.error ? reject(new Error(JSON.stringify(response.error))) : resolve(response.result ?? {}),
      );
      void client.send({ jsonrpc: '2.0', id, method, params });
    });

  await server.connect(serverSide);
  await client.start();
  try {
    await rpc('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'zigzag-docs', version: '1.0.0' },
    });
    await client.send({ jsonrpc: '2.0', method: 'notifications/initialized' });

    const tools = ((await rpc('tools/list')).tools ?? []) as ListedTool[];
    const prompts = ((await rpc('prompts/list')).prompts ?? []) as ListedPrompt[];

    return {
      tools: tools.map((tool) => ({
        name: tool.name,
        title: tool.title ?? tool.annotations?.title ?? tool.name,
        description: tool.description ?? '',
        readOnly: tool.annotations?.readOnlyHint === true,
        destructive: tool.annotations?.destructiveHint === true,
      })),
      prompts: prompts.map((prompt) => ({
        name: prompt.name,
        title: prompt.title ?? prompt.name,
        description: prompt.description ?? '',
      })),
    };
  } finally {
    await server.close();
  }
}
