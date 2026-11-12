/**
 * @jest-environment node
 *
 * The real MCP registry needs Node's Request, so this half of the page test
 * renders to HTML in the node environment instead of jsdom.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import AyudaAsistentesPage from '@/app/ayuda/asistentes/page';
import { readMcpCatalog } from '@/lib/mcp/registry-catalog';

jest.mock('next/headers', () => ({
  headers: async () => new Headers({ host: 'zigzag.example', 'x-forwarded-proto': 'https' }),
}));

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));

const between = (html: string, testId: string) => {
  const start = html.indexOf(`data-testid="${testId}"`);
  expect(start).toBeGreaterThan(-1);
  return html.slice(start, html.indexOf('</table>', start));
};

describe('/ayuda/asistentes tools table', () => {
  it('lists every tool and prompt in the server registry', async () => {
    const catalog = await readMcpCatalog();
    expect(catalog.tools.length).toBeGreaterThan(5);

    const html = renderToStaticMarkup(await AyudaAsistentesPage());

    const tools = between(html, 'docs-tools-table');
    for (const tool of catalog.tools) {
      expect(tools).toContain(`>${tool.name}</span>`);
    }
    expect(tools.match(/<tr /g)).toHaveLength(catalog.tools.length + 1);
    const prompts = between(html, 'docs-prompts-table');
    for (const prompt of catalog.prompts) {
      expect(prompts).toContain(`>${prompt.name}</td>`);
    }
    expect(html).toContain('https://zigzag.example/api/mcp');
  });
});
