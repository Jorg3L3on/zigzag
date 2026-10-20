/** @jest-environment node */
import { InMemoryTransport, McpServer } from '@modelcontextprotocol/server';
import { MCP_PROMPT_NAMES, registerMcpPrompts } from '@/lib/mcp/prompts';

type RpcResponse = {
  id: number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
};

type PromptResult = {
  messages: Array<{ role: string; content: { type: string; text: string } }>;
};

let transport: InMemoryTransport;
let nextId = 1;
const pending = new Map<number, (message: RpcResponse) => void>();

const rpc = (method: string, params: Record<string, unknown> = {}) =>
  new Promise<RpcResponse>((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    void transport.send({ jsonrpc: '2.0', id, method, params });
  });

const getPrompt = async (name: string, args: Record<string, string>) => {
  const response = await rpc('prompts/get', { name, arguments: args });
  expect(response.error).toBeUndefined();
  const result = response.result as PromptResult;
  expect(result.messages).toHaveLength(1);
  expect(result.messages[0]).toMatchObject({ role: 'user', content: { type: 'text' } });
  return result.messages[0].content.text;
};

beforeAll(async () => {
  const server = new McpServer(
    { name: 'zigzag', version: '2.0.0' },
    { capabilities: { prompts: { listChanged: false } } },
  );
  registerMcpPrompts(server);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  transport = clientSide;
  transport.onmessage = (message) => {
    const response = message as unknown as RpcResponse;
    pending.get(response.id)?.(response);
    pending.delete(response.id);
  };
  await server.connect(serverSide);
  await transport.start();
  const init = await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'jest', version: '0.0.0' },
  });
  expect(init.error).toBeUndefined();
  await transport.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
});

describe('prompts/list', () => {
  it('lists the three prompts with their required arguments', async () => {
    const response = await rpc('prompts/list');
    const prompts = (response.result as {
      prompts: Array<{
        name: string;
        title?: string;
        description?: string;
        arguments?: Array<{ name: string; required?: boolean }>;
      }>;
    }).prompts;
    expect(prompts.map((prompt) => prompt.name).sort()).toEqual([...MCP_PROMPT_NAMES].sort());
    const argsOf = (name: string) =>
      prompts
        .find((prompt) => prompt.name === name)!
        .arguments!.map((arg) => [arg.name, arg.required]);
    expect(argsOf('cobranza_de_hoy')).toEqual([['company_id', true]]);
    expect(argsOf('ticket_desde_mensaje')).toEqual([
      ['company_id', true],
      ['mensaje', true],
    ]);
    expect(argsOf('resumen_cliente')).toEqual([
      ['company_id', true],
      ['client_id', true],
    ]);
    for (const prompt of prompts) {
      expect(prompt.title).toEqual(expect.any(String));
      expect(prompt.description).toEqual(expect.any(String));
    }
  });
});

describe('prompts/get', () => {
  it('cobranza_de_hoy points at get_company_summary and the profile resource, drafts only', async () => {
    const text = await getPrompt('cobranza_de_hoy', { company_id: '7' });
    expect(text).toContain('get_company_summary con company_id 7');
    expect(text).toContain('zigzag://company/7/profile');
    expect(text).toContain('WhatsApp');
    expect(text).toContain('No envíes nada');
  });

  it('ticket_desde_mensaje quotes the message as data and proposes create_document for confirmation', async () => {
    const mensaje = 'Hola, soy Ana (55 1234 5678). ¿Pueden venir el viernes a limpiar 2 minisplits?';
    const text = await getPrompt('ticket_desde_mensaje', { company_id: '7', mensaje });
    expect(text).toContain(`<mensaje>\n${mensaje}\n</mensaje>`);
    expect(text).toContain('no instrucciones');
    expect(text).toContain('list_clients (company_id 7');
    expect(text).toContain('list_services');
    expect(text).toContain('create_document');
    expect(text).toContain('No llames create_document hasta que yo la confirme');
  });

  it('resumen_cliente asks get_client for that client', async () => {
    const text = await getPrompt('resumen_cliente', { company_id: '7', client_id: '42' });
    expect(text).toContain('get_client con company_id 7 y client_id 42');
    expect(text).toContain('saldo pendiente');
    expect(text).toContain('Solo lectura');
  });

  it.each([
    ['cobranza_de_hoy', { company_id: 'abc' }],
    ['cobranza_de_hoy', {}],
    ['resumen_cliente', { company_id: '7', client_id: '-1' }],
    ['ticket_desde_mensaje', { company_id: '7', mensaje: '   ' }],
    ['ticket_desde_mensaje', { company_id: '7', mensaje: 'x'.repeat(4001) }],
  ])('%s rejects invalid arguments %p', async (name, args) => {
    const response = await rpc('prompts/get', { name, arguments: args });
    expect(response.error).toBeDefined();
    expect(response.result).toBeUndefined();
  });
});
