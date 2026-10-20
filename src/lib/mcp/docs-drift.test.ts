/** @jest-environment node */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { readMcpCatalog } from '@/lib/mcp/registry-catalog';

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));

/**
 * The in-app guide renders its tools table from the registry; the markdown
 * reference does not, so this keeps it from drifting: a new tool fails here
 * until docs/mcp-connector.md lists it.
 */
describe('docs/mcp-connector.md', () => {
  it('lists every registered tool and prompt', async () => {
    const markdown = readFileSync(path.join(process.cwd(), 'docs/mcp-connector.md'), 'utf8');
    const { tools, prompts } = await readMcpCatalog();
    const missing = [...tools, ...prompts]
      .map((entry) => entry.name)
      .filter((name) => !markdown.includes(`\`${name}\``));
    expect(missing).toEqual([]);
  });
});
